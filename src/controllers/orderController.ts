import { Request, Response, NextFunction } from 'express';
import { OrderRoutingService } from '../services/OrderRoutingService';
import { OrderAcceptanceService } from '../services/OrderAcceptanceService';
import { ShippingService } from '../services/ShippingService';
import Order from '../models/Order';
import User from '../models/User';
import Product from '../models/Product';
import Coupon from '../models/Coupon';
import ShippingDetails from '../models/ShippingDetails';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest, isAdminRole } from '../middlewares/auth';
import logger from '../config/logger';
import { sanitizeOrdersForVendor } from '../utils/vendorOrderSanitizer';
import {
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendVendorOrderNotificationEmail,
  sendPaymentSuccessEmail,
  sendRefundCompletedEmail,
  sendShippingTrackingEmail,
} from '../services/emailer';
import { orderQueue } from '../services/OrderQueue';
import { assertCapturedPaymentForOrder } from '../services/paymentGuard';
import { getRazorpayInstance } from '../config/razorpay';
import cloudinary from '../config/cloudinary';
import streamifier from 'streamifier';

// Create order (customer)
export const createOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { items, customerPincode, customerAddress, couponCode } = req.body;

    if (!items || items.length === 0) {
      return next(new AppError('Order must have at least one item', 400));
    }

    if (!customerPincode || !customerAddress) {
      return next(new AppError('Pincode and address are required', 400));
    }

    // Every order must carry a contact number so vendors/admins can reach the
    // customer (Google-signup accounts may have no phone on the profile).
    let contactPhone = String(customerAddress.phone || req.user.phone || '').replace(/\D/g, '');
    if (contactPhone.length > 10) contactPhone = contactPhone.slice(-10); // drop +91 / leading 0
    if (contactPhone.length !== 10) {
      return next(new AppError('A valid 10-digit contact number is required to place an order', 400));
    }
    customerAddress.phone = contactPhone;
    if (!req.user.phone) {
      // Backfill the profile so future orders and admin views have it too
      await User.findByIdAndUpdate(req.user._id, { phone: contactPhone });
    }

    // ── Route order: creates DB documents, returns notification/sales metadata ─
    const { orders, notifications, salesRecords } = await OrderRoutingService.routeOrder({
      customer_id: req.user._id.toString(),
      items,
      customerPincode,
      customerAddress,
    });

    const isSplitShipment = orders.length > 1;
    logger.info(`[createOrder] ${orders.length} order(s) created (split: ${isSplitShipment})`);

    // ── Coupon validation (still synchronous – affects the response amount) ──
    const combinedSubtotal = orders.reduce((sum: number, order: any) => sum + order.total, 0);
    let discountAmount = 0;
    let appliedCouponData: { couponId: any; code: string; discount: number } | null = null;

    if (couponCode) {
      logger.info(`[createOrder] Validating coupon: ${couponCode}`);

      // Batch-fetch all products in one query (was an N+1: one findById per cart item)
      const productIds = items.map((item: any) => item.product_id);
      const productDocs: any[] = await Product.find({ _id: { $in: productIds } })
        .select('_id brand_id subCategory')
        .populate('brand_id', '_id')
        .lean();
      const productMap = new Map<string, any>(
        productDocs.map((p: any) => [p._id.toString(), p])
      );
      const productsInOrder = items.map((item: any) => {
        const product: any = productMap.get(item.product_id?.toString());
        return {
          productId: product?._id,
          brandId: product?.brand_id?._id,
          subcategory: product?.subCategory,
          quantity: item.quantity,
        };
      });

      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      if (!coupon) return next(new AppError('Invalid or inactive coupon code', 400));

      const now = new Date();
      if (coupon.validFrom && now < coupon.validFrom)
        return next(new AppError('Coupon is not yet valid', 400));
      if (coupon.validTo && now > coupon.validTo)
        return next(new AppError('Coupon has expired', 400));
      if (coupon.minOrderValue && combinedSubtotal < coupon.minOrderValue)
        return next(new AppError(`Minimum order value of ₹${coupon.minOrderValue} required`, 400));

      if (coupon.isFirstTimeOnly) {
        const previousOrders = await Order.countDocuments({ customer_id: req.user._id });
        if (previousOrders > 0)
          return next(new AppError('This coupon is only valid for first-time customers', 400));
      }

      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
        return next(new AppError('Coupon usage limit has been reached', 400));

      if (coupon.usagePerUser) {
        const userUsage = coupon.usedBy.find(
          (usage: any) => usage.user_id.toString() === req.user._id.toString()
        );
        if (userUsage && userUsage.usageCount >= coupon.usagePerUser)
          return next(new AppError('You have reached the usage limit for this coupon', 400));
      }

      if (coupon.applicableFor === 'SPECIFIC_BRANDS') {
        const ok = productsInOrder.some((p: any) =>
          coupon.brands.some((brandId: any) => brandId.toString() === p.brandId?.toString())
        );
        if (!ok) return next(new AppError('Coupon not applicable to products in cart', 400));
      } else if (coupon.applicableFor === 'SPECIFIC_CATEGORIES') {
        const ok = productsInOrder.some((p: any) => coupon.categories.includes(p.subcategory));
        if (!ok) return next(new AppError('Coupon not applicable to products in cart', 400));
      }

      if (coupon.discountType === 'PERCENTAGE') {
        discountAmount = Math.round((combinedSubtotal * coupon.discountValue) / 100);
        if (coupon.maxDiscount && discountAmount > coupon.maxDiscount)
          discountAmount = coupon.maxDiscount;
      } else {
        discountAmount = coupon.discountValue;
      }
      discountAmount = Math.min(discountAmount, combinedSubtotal);

      appliedCouponData = { couponId: coupon._id, code: coupon.code, discount: discountAmount };
      logger.info(`[createOrder] ✅ Coupon ${couponCode} applied – Discount: ₹${discountAmount}`);
    }

    // ── Shipping / platform fee ───────────────────────────────────────────────
    const hasPrimeProducts = orders.some((o: any) => o.isPrime);
    const hasNormalProducts = orders.some((o: any) => !o.isPrime);
    const isMixedOrder = hasPrimeProducts && hasNormalProducts;

    const shippingSettings = await ShippingService.getSettings();
    let charges = await ShippingService.calculateCharges(combinedSubtotal);
    // Prime/mixed surcharges must still honor the admin kill-switches
    if (hasPrimeProducts && shippingSettings.platformFeeEnabled) charges.platformFee = 10;
    if (isMixedOrder && shippingSettings.shippingEnabled && charges.shippingCharges === 0) charges.shippingCharges = 50;

    const subtotalAfterDiscount = combinedSubtotal - discountAmount;
    charges.total = subtotalAfterDiscount + charges.shippingCharges + charges.platformFee;

    // ── Apply charges to all orders in parallel ───────────────────────────────
    const discountPerOrder = Math.round(discountAmount / orders.length);
    await Promise.all(
      orders.map(async (order: any) => {
        order.subtotalBeforeCharges = order.total;
        order.discountAmount = discountPerOrder;
        order.couponCode = couponCode ? couponCode.toUpperCase() : undefined;
        order.shippingCharges = Math.round(charges.shippingCharges / orders.length);
        order.platformFee = Math.round(charges.platformFee / orders.length);
        order.total =
          order.subtotalBeforeCharges -
          order.discountAmount +
          order.shippingCharges +
          order.platformFee;
        order.grandTotal = order.total;
        return order.save();
      })
    );

    const totalAmount = orders.reduce((sum: number, o: any) => sum + o.total, 0);

    // ── Respond immediately ───────────────────────────────────────────────────
    res.status(201).json({
      success: true,
      message: isSplitShipment
        ? `Order created successfully! Your items will arrive in ${orders.length} separate shipments.`
        : 'Order created successfully',
      data: { orders, isSplitShipment, totalAmount },
    });

    // ── Emit background events (after response is sent) ───────────────────────

    // 1. Customer confirmation + admin emails
    const adminEmails = process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim()).filter(Boolean)
      : [];

    orderQueue.emit('order:created', {
      userEmail: req.user.email,
      userName: req.user.name,
      userId: req.user._id.toString(),
      orderIds: orders.map((o: any) => o._id.toString()),
      isSplitShipment,
      combinedSubtotal,
      shippingCharges: charges.shippingCharges,
      platformFee: charges.platformFee,
      discountAmount,
      couponCode: couponCode || undefined,
      customerAddress: orders[0].customerAddress,
      adminEmails,
      totalAmount,
    });

    // 2. Vendor notifications and sales recording are intentionally deferred.
    // Orders must not reach vendor workflows until payment is successful.

    // 4. Coupon usage recording
    if (appliedCouponData) {
      orderQueue.emit('order:record-coupon', {
        couponId: appliedCouponData.couponId.toString(),
        userId: req.user._id.toString(),
        couponCode: appliedCouponData.code,
      });
    }
  } catch (error: any) {
    next(error);
  }
};

// Get customer orders
export const getCustomerOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orders = await Order.find({ customer_id: req.user._id })
      .populate('items.product_id', 'name images')
      .populate('assignedVendorId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { orders },
    });
  } catch (error: any) {
    next(error);
  }
};

// Update order (for payment status updates)
export const updateOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { payment_id, payment_status, cancelOrder } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    const wasPaidBeforeUpdate = order.payment_status === 'Paid';

    // Check if user owns this order
    let customerId: string;
    if (order.customer_id && typeof order.customer_id === 'object' && '_id' in order.customer_id) {
      customerId = (order.customer_id as any)._id.toString();
    } else {
      customerId = order.customer_id.toString();
    }
    
    if (customerId !== req.user._id.toString() && !isAdminRole(req.user.role)) {
      return next(new AppError('Access denied', 403));
    }

    // Update payment details if provided
    if (payment_id) {
      order.payment_id = payment_id;
    }

    if (payment_status === 'Failed' && wasPaidBeforeUpdate) {
      return next(new AppError('Paid orders cannot be marked as failed', 400));
    }

    if (payment_status && ['Pending', 'Paid', 'Failed', 'Refunded'].includes(payment_status)) {
      // SECURITY: a client cannot simply declare an order Paid. Before honoring
      // 'Paid' we confirm with Razorpay that the payment is captured and belongs
      // to this order's razorpay order id. (Refunded is set only by admin/refund
      // flows that reach here with an already-Paid order.)
      if (payment_status === 'Paid' && !wasPaidBeforeUpdate) {
        await assertCapturedPaymentForOrder({
          razorpayOrderId: (order as any).razorpay_order_id,
          paymentId: payment_id || order.payment_id,
        });
      }

      order.payment_status = payment_status;

      // Payment completion does NOT change order status to ASSIGNED
      // Order should remain PENDING until vendor accepts it
      // ASSIGNED status is set when vendor accepts the order
    }

    // Allow customer/admin to cancel unpaid orders when payment is cancelled/failed.
    if (cancelOrder === true) {
      if (wasPaidBeforeUpdate) {
        return next(new AppError('Paid orders cannot be cancelled from payment flow', 400));
      }

      // Idempotent: re-cancelling an already-cancelled unpaid order is a no-op
      // success, so payment-failure cleanup retries never surface a scary
      // "order cleanup did not complete" message to the customer.
      if (order.status !== 'PENDING' && order.status !== 'CANCELLED') {
        return next(new AppError('Only pending orders can be cancelled from payment flow', 400));
      }

      order.status = 'CANCELLED';
      order.assignedVendorId = null as any;
      order.assignedVendors = [] as any;
      order.acceptanceDeadline = undefined;
      if (!payment_status) {
        order.payment_status = 'Failed';
      }
    }

    // Any failed payment order must be unassigned from vendor workflow.
    if (order.payment_status === 'Failed' && !wasPaidBeforeUpdate) {
      if (order.status === 'PENDING') {
        order.status = 'CANCELLED';
      }
      order.assignedVendorId = null as any;
      order.assignedVendors = [] as any;
      order.acceptanceDeadline = undefined;
    }

    await order.save();

    // Queue payment receipt email when payment is completed (non-blocking)
    if (payment_status === 'Paid') {
      logger.info('[updateOrder] Payment completed, queueing receipt email...');
      try {
        const populatedOrder = await order.populate(['customer_id', 'items.product_id']);
        const customer = populatedOrder.customer_id as any;

        if (customer?.email) {
          logger.info('[updateOrder] Queueing payment receipt to:', customer.email);
          const orderId = order._id.toString().slice(-8).toUpperCase();
          sendPaymentSuccessEmail(
            customer.email,
            customer.name || 'Customer',
            orderId,
            order.total || 0,
            order.payment_id,
            {
              items: populatedOrder.items,
              customerAddress: order.customerAddress,
              paymentGateway: order.payment_gateway || 'Razorpay',
              paymentMethod: 'Online Payment',
            }
          ).then(() => logger.info('[updateOrder] ✅ Payment receipt email sent'))
           .catch((e: any) => logger.error('[updateOrder] ❌ Payment receipt email failed:', e.message));
        } else {
          logger.info('[updateOrder] ⚠️ No customer email found, skipping receipt');
        }

        // Notify the assigned vendor(s) that a paid order is waiting for acceptance
        const assignedVendorIdStr = (populatedOrder.assignedVendorId as any)?._id?.toString()
          || (populatedOrder.assignedVendorId as any)?.toString?.();
        const assignedVendorsArr = (populatedOrder.assignedVendors || []) as any[];
        const isPrimeOrder = populatedOrder.isPrime;

        const vendorIds: string[] = [];
        let isBroadcast = false;

        if (isPrimeOrder && assignedVendorIdStr) {
          vendorIds.push(assignedVendorIdStr);
          isBroadcast = false;
        } else if (assignedVendorsArr.length > 0) {
          vendorIds.push(...assignedVendorsArr.map((v: any) => v._id?.toString() || v.toString()));
          isBroadcast = true;
        }

        if (vendorIds.length > 0) {
          const orderItems = (populatedOrder.items || []).map((item: any) => ({
            name: (item.product_id as any)?.name || 'Product',
            quantity: item.quantity,
            price: item.sellingPrice || item.price || 0,
          }));
          orderQueue.emit('order:vendor-notify', {
            orderId: populatedOrder._id.toString(),
            customerId: (customer as any)?._id?.toString() || populatedOrder.customer_id.toString(),
            vendorIds,
            orderItems,
            orderTotal: populatedOrder.total || 0,
            customerAddress: populatedOrder.customerAddress || {},
            customerPincode: (populatedOrder.customerAddress as any)?.pincode || (populatedOrder as any).customerPincode || '',
            isBroadcast,
          });
          logger.info(`[updateOrder] ✅ Vendor notification queued for order ${populatedOrder._id}`);
        } else {
          logger.info('[updateOrder] ⚠️ No vendor assigned to notify for this order');
        }
      } catch (emailError: any) {
        logger.error('[updateOrder] ❌ Failed to send payment receipt or vendor notify:', emailError.message);
        // Don't fail the order update if email/notify fails
      }
    }
    res.status(200).json({
      success: true,
      message: 'Order updated successfully',
      data: { order },
    });
  } catch (error: any) {
    next(error);
  }
};

// Get order by ID
export const getOrderById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product_id', 'name images')
      .populate('assignedVendorId', 'name email phone vendorType')
      .populate('customer_id', 'name email phone');

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Get customer_id - handle both populated and unpopulated cases
    // When populated, customer_id is a User document with _id property
    // When not populated, it's an ObjectId or string
    const customerIdValue = order.customer_id as any;
    const customerId = customerIdValue?._id 
      ? customerIdValue._id.toString() 
      : customerIdValue?.id 
      ? customerIdValue.id.toString()
      : customerIdValue.toString();

    // Get assigned vendor IDs
    const assignedVendorIdValue = order.assignedVendorId as any;
    const assignedVendorId = assignedVendorIdValue?._id
      ? assignedVendorIdValue._id.toString()
      : assignedVendorIdValue?.id
      ? assignedVendorIdValue.id.toString()
      : assignedVendorIdValue?.toString();

    const userId = req.user._id.toString();

    // Check if user has access
    const isCustomer = customerId === userId;
    const isAdmin = isAdminRole(req.user.role);
    const isAssignedVendor = (assignedVendorId && assignedVendorId === userId) || 
      (order.assignedVendors && order.assignedVendors.some((vid) => vid.toString() === userId));

    if (!isCustomer && !isAdmin && !isAssignedVendor) {
      logger.error('Access denied for order:', {
        orderId: req.params.id,
        customerId,
        userId,
        userRole: req.user.role,
        isCustomer,
        isAdmin,
        isAssignedVendor,
        assignedVendorId,
        customerIdType: typeof customerIdValue,
        customerIdHasId: !!customerIdValue?.id,
        customerIdHas_id: !!customerIdValue?._id,
      });
      return next(new AppError('Access denied', 403));
    }

    // Debug logging for discount fields
    logger.info('DEBUG - getOrderById - Discount fields:', {
      orderId: order._id,
      discountAmount: order.discountAmount,
      couponCode: order.couponCode,
      subtotalBeforeCharges: order.subtotalBeforeCharges,
      total: order.total,
    });

    // The assigned vendor's phone is exposed for admins only (so they can call
    // a vendor who adjusted prices). Never leak vendor contact to the customer.
    const orderResponse: any = order.toObject();
    if (!isAdmin && orderResponse.assignedVendorId && typeof orderResponse.assignedVendorId === 'object') {
      delete orderResponse.assignedVendorId.phone;
    }

    // Attach shipment info so the customer can track their parcel. Only the
    // customer-safe fields — never the vendor's receipt or shipping cost.
    const shippingDoc = await ShippingDetails.findOne({ order_id: order._id })
      .select('shipping_company tracking_id tracking_link')
      .lean();
    if (shippingDoc) {
      orderResponse.shippingDetails = {
        shipping_company: shippingDoc.shipping_company,
        tracking_id: shippingDoc.tracking_id,
        tracking_link: shippingDoc.tracking_link,
      };
    }

    res.status(200).json({
      success: true,
      data: { order: orderResponse },
    });
  } catch (error: any) {
    logger.error('Error in getOrderById:', error);
    next(error);
  }
};

// Get pending orders for vendor
export const getPendingOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vendorId = req.user._id.toString();
    logger.info(`[getPendingOrders Controller] Request from vendor: ${vendorId}, User object:`, {
      _id: req.user._id,
      email: req.user.email,
      role: req.user.role,
    });
    
    const orders = await OrderAcceptanceService.getPendingOrders(vendorId);
    
    logger.info(`[getPendingOrders Controller] Returning ${orders.length} orders to vendor ${vendorId}`);
    
    res.status(200).json({
      success: true,
      data: { orders },
    });
  } catch (error: any) {
    logger.error(`[getPendingOrders Controller] Error:`, error);
    next(error);
  }
};

// Accept order (vendor)
export const acceptOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await OrderAcceptanceService.acceptOrder(
      req.params.id,
      req.user._id.toString(),
      req.body?.priceUpdates
    );
    res.status(200).json({
      success: true,
      message: 'Order accepted successfully',
      data: { order },
    });
  } catch (error: any) {
    next(error);
  }
};

// Reject order (vendor)
export const rejectOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const order = await OrderAcceptanceService.rejectOrder(
      req.params.id,
      req.user._id.toString(),
      reason
    );
    res.status(200).json({
      success: true,
      message: 'Order rejected',
      data: { order },
    });
  } catch (error: any) {
    next(error);
  }
};

// Get vendor orders (all orders assigned to this vendor)
export const getVendorOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const mongoose = await import('mongoose');
    const vendorId = req.user._id;
    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);
    
    logger.info(`[getVendorOrders] Fetching orders for vendor: ${vendorId}`);
    
    const orders = await Order.find({
      assignedVendorId: vendorObjectId,
      payment_status: 'Paid',
      // Exclude orders still awaiting acceptance (PENDING/ASSIGNED) — those belong on
      // the pending-orders page. Prime orders are ASSIGNED until accepted, so both
      // must be excluded here to match the web's accepted-orders list.
      status: { $nin: ['PENDING', 'ASSIGNED'] },
    })
      .populate('customer_id', 'name email phone')
      .populate('items.product_id', 'name images')
      .sort({ createdAt: -1 });

    logger.info(`[getVendorOrders] Found ${orders.length} orders for vendor ${vendorId}`);

    // Vendor earnings include the shipping cost they entered on the shipping
    // details form, so surface it on each order for the list cards.
    const shippingDocs = await ShippingDetails.find({
      order_id: { $in: orders.map(o => o._id) },
    })
      .select('order_id shipping_cost')
      .lean();
    const shippingCostByOrder = new Map(
      shippingDocs.map(d => [d.order_id.toString(), d.shipping_cost || 0])
    );

    res.status(200).json({
      success: true,
      data: {
        orders: sanitizeOrdersForVendor(
          orders.map(o => ({
            ...o.toObject(),
            // Vendor payout = purchase price + the courier cost THEY submitted on
            // the shipping-details form. The delivery charge the customer paid is
            // platform revenue, never part of the vendor's cut.
            shippingCost: shippingCostByOrder.get(o._id.toString()) || 0,
          }))
        ),
      },
    });
  } catch (error: any) {
    logger.error('[getVendorOrders] Error:', error);
    next(error);
  }
};

// Get order details for vendor
export const getVendorOrderDetails = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const orderId = req.params.id;
    
    // Validate that the ID is not a reserved word like "my" or "pending"
    if (orderId === 'my' || orderId === 'pending') {
      return next(new AppError('Invalid order ID', 400));
    }
    
    // Validate ObjectId format
    const mongoose = await import('mongoose');
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return next(new AppError('Invalid order ID format', 400));
    }
    
    const order = await OrderAcceptanceService.getOrderDetails(
      orderId,
      req.user._id.toString()
    );
    res.status(200).json({
      success: true,
      data: { order },
    });
  } catch (error: any) {
    next(error);
  }
};

// Update order status (vendor) - Mark as PACKED, PICKED_UP, IN_TRANSIT, or DELIVERED
export const updateOrderStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;
    const vendorId = req.user._id.toString();

    // Validate status
    const allowedStatuses = ['PACKED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];
    if (!status || !allowedStatuses.includes(status)) {
      return next(new AppError('Invalid status. Allowed: PACKED, PICKED_UP, IN_TRANSIT, DELIVERED', 400));
    }

    // Validate ObjectId format
    const mongoose = await import('mongoose');
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return next(new AppError('Invalid order ID format', 400));
    }

    const order = await Order.findById(orderId)
      .populate('customer_id', 'email name phone')
      .populate('assignedVendorId', 'name');
    
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check if vendor owns this order.
    // assignedVendorId is populated above, so extract its _id before comparing
    // (a populated document's toString() is "[object Object]", never the id).
    const assignedVendorId =
      (order.assignedVendorId as any)?._id?.toString() ??
      (order.assignedVendorId as any)?.toString();
    if (assignedVendorId !== vendorId) {
      return next(new AppError('You are not assigned to this order', 403));
    }

    // Map internal status to customer-friendly status
    const statusMap: Record<string, string> = {
      PACKED: 'processing',
      PICKED_UP: 'shipped',
      IN_TRANSIT: 'shipped',
      DELIVERED: 'delivered',
    };

    // Courier name + tracking ID are REQUIRED at the shipping step (handover to
    // courier = PICKED_UP, or IN_TRANSIT) so the customer always gets a real
    // tracking ID in the Track Package view. Skipped if already captured earlier.
    if (status === 'PICKED_UP' || status === 'IN_TRANSIT') {
      const courierName = String(req.body.courier_name || req.body.courier || '').trim();
      const trackingId = String(req.body.tracking_id || req.body.trackingNumber || '').trim();
      const alreadyHasTracking = !!(order.courier && order.courier.name && order.courier.tracking_id);
      if (!alreadyHasTracking && (!courierName || !trackingId)) {
        return next(new AppError('Courier name and tracking ID are required to ship this order.', 400));
      }
      if (courierName && trackingId) {
        if (!order.courier) order.courier = {};
        order.courier.name = courierName;
        order.courier.tracking_id = trackingId;
      }
    }

    // Update status
    order.status = status as any;
    await order.save();

    // When order is delivered, credit vendor's wallet with their earnings
    // (purchase price total + the courier cost they submitted in shipping details)
    if (status === 'DELIVERED') {
      try {
        const { WalletService } = await import('../services/WalletService');
        const { default: ShippingDetails } = await import('../models/ShippingDetails');
        // Sum up purchaseSubtotal for items belonging to this vendor
        const vendorItems = order.items.filter(
          (item: any) => item.vendor_id?.toString() === vendorId
        );
        const shippingDoc = await ShippingDetails.findOne({ order_id: order._id, vendor_id: vendorId })
          .select('shipping_cost')
          .lean();
        // Only the courier cost the vendor submitted counts toward their payout.
        // The customer's delivery charge is platform revenue — never the vendor's.
        const deliveryCharge = Number(shippingDoc?.shipping_cost) || 0;
        const vendorEarning = vendorItems.reduce(
          (sum: number, item: any) => sum + (item.purchaseSubtotal || 0),
          0
        ) + deliveryCharge;
        if (vendorEarning > 0) {
          await WalletService.addEarnings(vendorId, orderId, vendorEarning);
          logger.info(`[updateOrderStatus] Wallet credited ₹${vendorEarning} for vendor ${vendorId}`);
        }
      } catch (walletError: any) {
        // Non-blocking — don't fail the status update if wallet credit fails
        logger.error('[updateOrderStatus] Wallet credit failed:', walletError.message);
      }
    }

    // Queue status update email to customer (non-blocking)
    try {
      const customerEmail = (order.customer_id as any)?.email;
      const customerName = (order.customer_id as any)?.name;
      const vendorName = (order.assignedVendorId as any)?.name;

      if (customerEmail) {
        sendOrderStatusUpdateEmail(
          customerEmail,
          customerName || 'Customer',
          orderId,
          statusMap[status] || status.toLowerCase(),
          vendorName,
          order.courier?.tracking_id || order.courier?.tracking_link
            ? {
                company: order.courier?.name,
                trackingId: order.courier?.tracking_id,
                trackingLink: order.courier?.tracking_link,
              }
            : undefined
        ).then(() => logger.info('[updateOrderStatus] ✅ Status update email sent'))
         .catch((e: any) => logger.error('[updateOrderStatus] ❌ Status update email failed:', e.message));
      }
    } catch (emailError: any) {
      logger.error('Failed to send status update email:', emailError.message);
      // Don't fail the status update if email fails
    }

    logger.info(`[updateOrderStatus] Order ${orderId} status updated to ${status} by vendor ${vendorId}`);

    res.status(200).json({
      success: true,
      message: `Order marked as ${status}`,
      data: { order },
    });
  } catch (error: any) {
    logger.error('[updateOrderStatus] Error:', error);
    next(error);
  }
};
// Admin: Update any order status
export const adminUpdateOrderStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;

    // Validate status
    const allowedStatuses = ['PENDING', 'ASSIGNED', 'ACCEPTED', 'REJECTED', 'PACKED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'REFUND_INITIATED', 'REFUNDED'];
    if (!status || !allowedStatuses.includes(status)) {
      return next(new AppError('Invalid status', 400));
    }

    const mongoose = await import('mongoose');
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return next(new AppError('Invalid order ID format', 400));
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    order.status = status as any;
    await order.save();

    logger.info(`[adminUpdateOrderStatus] Order ${orderId} status updated to ${status} by admin ${req.user._id}`);

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: { order },
    });
  } catch (error: any) {
    logger.error('[adminUpdateOrderStatus] Error:', error);
    next(error);
  }
};

// Admin: Manually assign order to vendor
export const adminAssignOrderToVendor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const orderId = req.params.id;
    const { vendorId } = req.body;

    if (!vendorId) {
      return next(new AppError('Vendor ID is required', 400));
    }

    const mongoose = await import('mongoose');
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(vendorId)) {
      return next(new AppError('Invalid ID format', 400));
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Verify vendor exists
    const User = (await import('../models/User')).default;
    const vendor = await User.findById(vendorId);
    if (!vendor || !['vendor', 'retail_vendor', 'special_vendor'].includes(vendor.role)) {
      return next(new AppError('Invalid vendor', 400));
    }

    // Update assignment
    order.assignedVendorId = vendorId as any;
    order.status = 'ASSIGNED';
    await order.save();

    logger.info(`[adminAssignOrderToVendor] Order ${orderId} assigned to vendor ${vendorId} by admin ${req.user._id}`);

    res.status(200).json({
      success: true,
      message: 'Order assigned to vendor successfully',
      data: { order },
    });
  } catch (error: any) {
    logger.error('[adminAssignOrderToVendor] Error:', error);
    next(error);
  }
};

// Admin: Process a refund for a paid order. Hits the Razorpay refund API for the
// captured payment, then marks the order REFUNDED.
export const adminProcessRefund = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const orderId = req.params.id;

    const mongoose = await import('mongoose');
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return next(new AppError('Invalid order ID format', 400));
    }

    const order = await Order.findById(orderId).populate('customer_id', 'name email phone');
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Already refunded — nothing to do.
    if (order.status === 'REFUNDED' || order.payment_status === 'Refunded') {
      return next(new AppError('This order has already been refunded.', 400));
    }

    // Only a captured (Paid) payment can be refunded back to the customer.
    if (order.payment_status !== 'Paid') {
      return next(new AppError(`Cannot refund: order payment status is "${order.payment_status}". Only Paid orders can be refunded.`, 400));
    }

    // Amount to send back (in rupees). Razorpay expects the smallest unit (paise).
    const refundAmountRupees = order.refundAmount || order.grandTotal || order.total || 0;
    if (refundAmountRupees <= 0) {
      return next(new AppError('Refund amount could not be determined for this order.', 400));
    }

    // Hit the Razorpay refund API for the captured payment. When payments are
    // disabled (SKIP_PAYMENT / no keys, e.g. local dev) we skip the gateway call.
    const razorpay = getRazorpayInstance();
    if (razorpay) {
      if (!order.payment_id) {
        return next(new AppError('This order has no Razorpay payment id, so it cannot be refunded automatically.', 400));
      }
      try {
        const refund = await razorpay.payments.refund(order.payment_id, {
          amount: Math.round(refundAmountRupees * 100),
          speed: 'normal',
          notes: {
            orderId: order._id.toString(),
            reason: order.refundReason || 'Refund processed by admin',
          },
        });
        order.refundId = refund.id;
        order.refundStatus = refund.status === 'processed' ? 'COMPLETED' : 'PROCESSING';
        logger.info(`[adminProcessRefund] Razorpay refund ${refund.id} created for order ${orderId} (₹${refundAmountRupees}, status: ${refund.status})`);
      } catch (rzpError: any) {
        const desc = rzpError?.error?.description || rzpError?.message || 'Razorpay refund request failed';
        logger.error(`[adminProcessRefund] Razorpay refund failed for order ${orderId}: ${desc}`);
        return next(new AppError(`Razorpay refund failed: ${desc}`, 502));
      }
    } else {
      logger.warn(`[adminProcessRefund] Razorpay not configured; marking order ${orderId} refunded without a gateway call`);
      order.refundStatus = 'COMPLETED';
    }

    // Mark order as refunded
    order.status = 'REFUNDED';
    order.payment_status = 'Refunded';
    order.refundAmount = refundAmountRupees;
    order.refundedAt = new Date();
    await order.save();

    logger.info(`[adminProcessRefund] Refund processed for order ${orderId} by admin ${req.user._id}`);

    // Send refund completed email to customer
    try {
      const customer = order.customer_id as any;
      if (customer?.email) {
        const shortId = `#${order._id.toString().slice(-8).toUpperCase()}`;
        await sendRefundCompletedEmail(
          customer.email,
          customer.name || 'Customer',
          shortId,
          order.refundAmount || order.grandTotal || order.total || 0
        );
      }
    } catch (emailError: any) {
      logger.error('[adminProcessRefund] Failed to send refund completed email:', emailError.message);
      // Don't fail the refund if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully. Customer has been notified.',
      data: { order },
    });
  } catch (error: any) {
    logger.error('[adminProcessRefund] Error:', error);
    next(error);
  }
};

// Vendor: Get shipping details for own order (company, tracking, cost, weight, receipt)
export const getVendorOrderShippingDetails = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const mongoose = await import('mongoose');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid order ID', 400));
    }

    const vendorId = req.user._id.toString();
    const shippingDetails = await ShippingDetails.findOne({ order_id: id }).lean();

    // Only the submitting vendor or the vendor assigned to the order may read it.
    if (shippingDetails && shippingDetails.vendor_id?.toString() !== vendorId) {
      const order = await Order.findById(id).select('assignedVendorId').lean();
      if (order?.assignedVendorId?.toString() !== vendorId) {
        return next(new AppError('You are not assigned to this order', 403));
      }
    }

    res.status(200).json({
      success: true,
      data: { shippingDetails: shippingDetails || null },
    });
  } catch (error: any) {
    logger.error('[getVendorOrderShippingDetails] Error:', error);
    next(error);
  }
};

// Admin: Get shipping details for an order (courier, tracking, address)
export const getOrderShippingDetails = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const mongoose = await import('mongoose');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid order ID', 400));
    }

    const shippingDetails = await ShippingDetails.findOne({ order_id: id }).lean();

    res.status(200).json({
      success: true,
      data: { shippingDetails: shippingDetails || null },
    });
  } catch (error: any) {
    logger.error('[getOrderShippingDetails] Error:', error);
    next(error);
  }
};

// Admin/Sub-admin: add courier & tracking on the vendor's behalf.
// Mirrors the warehouse-fulfiller addShippingDetails flow (PACKED → READY_TO_SHIP)
// so the admin process matches Prime Vendor / Warehouse Fulfiller exactly.
export const adminAddShippingDetails = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const orderId = req.params.id;

    const mongoose = await import('mongoose');
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return next(new AppError('Invalid order ID format', 400));
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.status !== 'PACKED') {
      return next(
        new AppError(
          `Cannot add shipping details. Order must be PACKED first. Current status: ${order.status}`,
          400
        )
      );
    }

    const courierName = String(
      req.body.shipping_company || req.body.courier_name || req.body.courier || ''
    ).trim();
    const trackingId = String(req.body.tracking_id || req.body.trackingNumber || '').trim();
    const trackingLink = String(req.body.tracking_link || '').trim();
    const { shipping_cost, total_weight, weight_unit, delivery_type } = req.body;

    if (!courierName) {
      return next(new AppError('Shipping company name is required', 400));
    }
    if (!trackingId) {
      return next(new AppError('Tracking ID is required', 400));
    }
    if (!trackingLink) {
      return next(new AppError('Tracking link is required', 400));
    }
    if (!/^https?:\/\/\S+$/i.test(trackingLink)) {
      return next(new AppError('Tracking link must be a valid URL starting with http:// or https://', 400));
    }
    if (shipping_cost !== undefined && String(shipping_cost).trim() !== '') {
      if (isNaN(Number(shipping_cost)) || Number(shipping_cost) < 0) {
        return next(new AppError('Shipping cost must be a non-negative number', 400));
      }
    }
    const hasWeight = total_weight !== undefined && String(total_weight).trim() !== '';
    if (hasWeight && (isNaN(Number(total_weight)) || Number(total_weight) <= 0)) {
      return next(new AppError('Total weight must be a positive number', 400));
    }
    if (hasWeight && !['kg', 'g'].includes(weight_unit)) {
      return next(new AppError('Weight unit must be kg or g', 400));
    }
    if (delivery_type && !['inter_state', 'out_of_state'].includes(delivery_type)) {
      return next(new AppError('Delivery type must be inter_state or out_of_state', 400));
    }

    const existing = await ShippingDetails.findOne({ order_id: orderId });
    if (existing) {
      return next(new AppError('Shipping details already submitted for this order', 409));
    }

    // ── Upload receipt to Cloudinary (optional) ──
    let uploadResult: any = null;
    if (req.file) {
      const isPdf = req.file.mimetype === 'application/pdf';
      uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'petmaza/shipping-receipts',
            resource_type: isPdf ? 'raw' : 'image',
            ...(isPdf ? { format: 'pdf' } : {}),
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        streamifier.createReadStream(req.file!.buffer).pipe(stream);
      });
    }

    // Attribute the record to the assigned vendor when there is one, else the acting admin.
    const attributedVendorId = order.assignedVendorId || req.user._id;

    await ShippingDetails.create({
      order_id: orderId,
      vendor_id: attributedVendorId,
      shipping_company: courierName,
      ...(uploadResult
        ? { receipt_file_url: uploadResult.secure_url, receipt_file_public_id: uploadResult.public_id }
        : {}),
      tracking_id: trackingId,
      tracking_link: trackingLink,
      ...(shipping_cost !== undefined && String(shipping_cost).trim() !== ''
        ? { shipping_cost: Number(shipping_cost) }
        : {}),
      ...(hasWeight ? { total_weight: Number(total_weight), weight_unit } : {}),
      ...(delivery_type ? { delivery_type } : {}),
    });

    if (!order.courier) order.courier = {};
    order.courier.name = courierName;
    order.courier.tracking_id = trackingId;
    order.courier.tracking_link = trackingLink;

    order.status = 'READY_TO_SHIP';
    await order.save();

    logger.info(`[adminAddShippingDetails] Order ${orderId} → READY_TO_SHIP by admin ${req.user._id} (courier ${courierName}, tracking ${trackingId})`);

    // Send tracking details email to customer (shipping cost is NOT included)
    try {
      const populatedOrder = await order.populate('customer_id');
      const customer = populatedOrder.customer_id as any;
      if (customer?.email) {
        await sendShippingTrackingEmail(
          customer.email,
          customer.name || 'Customer',
          order._id.toString().slice(-8),
          {
            company: courierName,
            trackingId,
            trackingLink,
            deliveryType: delivery_type,
            totalWeight: hasWeight ? Number(total_weight) : undefined,
            weightUnit: hasWeight ? weight_unit : undefined,
            estimatedDelivery: '1-3 business days',
          }
        );
      }
    } catch (emailError: any) {
      logger.error('Failed to send shipping tracking email:', emailError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Shipping details saved. Order marked as Ready to Ship.',
      data: { order },
    });
  } catch (error: any) {
    logger.error('[adminAddShippingDetails] Error:', error);
    next(error);
  }
};

/**
 * Create Prime Order
 * Creates a direct order for a prime product listing
 */
export const createPrimeOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { primeProductId, quantity, customerPincode, customerAddress } = req.body;

    // Validation
    if (!primeProductId || !quantity) {
      return next(new AppError('Prime product ID and quantity are required', 400));
    }

    if (!customerPincode || !customerAddress) {
      return next(new AppError('Pincode and address are required', 400));
    }

    // Same contact-number rule as createOrder
    let contactPhone = String(customerAddress.phone || req.user.phone || '').replace(/\D/g, '');
    if (contactPhone.length > 10) contactPhone = contactPhone.slice(-10); // drop +91 / leading 0
    if (contactPhone.length !== 10) {
      return next(new AppError('A valid 10-digit contact number is required to place an order', 400));
    }
    customerAddress.phone = contactPhone;
    if (!req.user.phone) {
      await User.findByIdAndUpdate(req.user._id, { phone: contactPhone });
    }

    // After unification, the Product IS the prime listing
    const primeListing = await Product.findOne({ _id: primeProductId, isPrime: true })
      .populate('primeVendor_id', 'name email shopName pincodesServed');

    if (!primeListing) {
      return next(new AppError('Prime product listing not found', 404));
    }

    if (!primeListing.isActive || !primeListing.isAvailable) {
      return next(new AppError('This product is not available', 400));
    }

    // Check stock
    if (quantity > primeListing.stock) {
      return next(new AppError(`Only ${primeListing.stock} items available in stock`, 400));
    }

    // Check min/max order quantity
    if (quantity < primeListing.minOrderQuantity) {
      return next(new AppError(`Minimum order quantity is ${primeListing.minOrderQuantity}`, 400));
    }

    if (quantity > primeListing.maxOrderQuantity) {
      return next(new AppError(`Maximum order quantity is ${primeListing.maxOrderQuantity}`, 400));
    }

    // Check if vendor serves this pincode
    const vendor = await User.findById(primeListing.primeVendor_id);
    if (!vendor) {
      return next(new AppError('Vendor not found', 404));
    }

    if (!vendor.pincodesServed || !vendor.pincodesServed.includes(customerPincode)) {
      return next(new AppError('Vendor does not deliver to this pincode', 400));
    }

    // Calculate order total — sellingPrice IS the vendor price after unification
    const itemTotal = (primeListing.sellingPrice ?? 0) * quantity;
    const primeSettings = await ShippingService.getSettings();
    const platformFee = primeSettings.platformFeeEnabled ? 10 : 0; // ₹10 for prime, unless platform fee disabled in admin
    const shippingCharges = 0; // Free shipping for prime
    const grandTotal = itemTotal + platformFee + shippingCharges;

    // Create order
    const order = await Order.create({
      customer_id: req.user._id,
      items: [{
        product_id: primeListing._id,
        originalPrice: primeListing.mrp,
        quantity: quantity,
        priceAtPurchase: primeListing.sellingPrice,
        subtotal: itemTotal,
        fulfillmentType: 'PRIME_VENDOR',
        variant_id: null,
      }],
      total: itemTotal,
      platformFee: platformFee,
      shippingCharges: shippingCharges,
      grandTotal: grandTotal,
      assignedVendorId: primeListing.primeVendor_id,
      customerPincode: customerPincode,
      customerAddress: customerAddress,
      status: 'ASSIGNED', // Direct to vendor
      isPrime: true,
      isSplitShipment: false,
      orderType: 'PRIME',
    });

    // Update prime product stock and analytics atomically
    await Product.findByIdAndUpdate(primeProductId, {
      $inc: { stock: -quantity, ordersCount: 1, soldQuantity: quantity },
    });

    // Populate order for response
    await order.populate('items.product_id');

    // Queue order confirmation email to customer (non-blocking)
    logger.info('[createPrimeOrder] Queueing prime order confirmation email to:', req.user.email);
    try {
      sendOrderConfirmationEmail(
        req.user.email,
        req.user.name,
        `#${order._id.toString().slice(-8)}`,
        {
          totalAmount: grandTotal,
          items: order.items,
          customerAddress: order.customerAddress,
          shippingCharges: shippingCharges,
          platformFee: platformFee,
          subtotal: itemTotal,
          isSplitShipment: false,
          isPrimeOrder: true,
          vendorName: (primeListing.primeVendor_id as any).shopName || (primeListing.primeVendor_id as any).name,
        }
      ).then(() => logger.info('[createPrimeOrder] ✅ Order confirmation email sent'))
       .catch((e: any) => logger.error('[createPrimeOrder] ❌ Order confirmation email failed:', e.message));
    } catch (emailError: any) {
      logger.error('[createPrimeOrder] ❌ Order confirmation email error:', emailError.message);
    }

    // Queue vendor notification email (non-blocking)
    try {
      const vendorEmail = (primeListing.primeVendor_id as any).email;
      sendVendorOrderNotificationEmail(
        vendorEmail,
        (primeListing.primeVendor_id as any).shopName || (primeListing.primeVendor_id as any).name,
        order._id.toString(),
        {
          items: order.items,
          totalAmount: itemTotal,
          customerAddress: order.customerAddress,
          customerPincode: order.customerPincode,
        }
      ).then(() => logger.info('[createPrimeOrder] ✅ Vendor notification email sent'))
       .catch((e: any) => logger.error('[createPrimeOrder] ❌ Vendor notification email failed:', e.message));
    } catch (emailError: any) {
      logger.error('[createPrimeOrder] ❌ Vendor notification email error:', emailError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Prime order created successfully',
      data: { 
        order,
        isPrimeOrder: true,
        deliveryTime: (primeListing as any).deliveryTime,
      },
    });

  } catch (error: any) {
    next(error);
  }
};