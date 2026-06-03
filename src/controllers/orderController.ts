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
} from '../services/emailer';
import { orderQueue } from '../services/OrderQueue';

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

      const productsInOrder = await Promise.all(
        items.map(async (item: any) => {
          const product: any = await Product.findById(item.product_id).populate('brand_id');
          return {
            productId: product?._id,
            brandId: product?.brand_id?._id,
            subcategory: product?.subCategory,
            quantity: item.quantity,
          };
        })
      );

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

    let charges = await ShippingService.calculateCharges(combinedSubtotal);
    if (hasPrimeProducts) charges.platformFee = 10;
    if (isMixedOrder && charges.shippingCharges === 0) charges.shippingCharges = 50;

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
      .populate('assignedVendorId', 'name email')
      .populate('customer_id', 'name email');

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
      console.error('Access denied for order:', {
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
    console.log('DEBUG - getOrderById - Discount fields:', {
      orderId: order._id,
      discountAmount: order.discountAmount,
      couponCode: order.couponCode,
      subtotalBeforeCharges: order.subtotalBeforeCharges,
      total: order.total,
    });

    res.status(200).json({
      success: true,
      data: { order },
    });
  } catch (error: any) {
    console.error('Error in getOrderById:', error);
    next(error);
  }
};

// Get pending orders for vendor
export const getPendingOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vendorId = req.user._id.toString();
    console.log(`[getPendingOrders Controller] Request from vendor: ${vendorId}, User object:`, {
      _id: req.user._id,
      email: req.user.email,
      role: req.user.role,
    });
    
    const orders = await OrderAcceptanceService.getPendingOrders(vendorId);
    
    console.log(`[getPendingOrders Controller] Returning ${orders.length} orders to vendor ${vendorId}`);
    
    res.status(200).json({
      success: true,
      data: { orders },
    });
  } catch (error: any) {
    console.error(`[getPendingOrders Controller] Error:`, error);
    next(error);
  }
};

// Accept order (vendor)
export const acceptOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await OrderAcceptanceService.acceptOrder(
      req.params.id,
      req.user._id.toString()
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
    
    console.log(`[getVendorOrders] Fetching orders for vendor: ${vendorId}`);
    
    const orders = await Order.find({
      assignedVendorId: vendorObjectId,
      payment_status: 'Paid',
      status: { $ne: 'PENDING' }, // Exclude pending orders (those are in pending orders page)
    })
      .populate('customer_id', 'name email phone')
      .populate('items.product_id', 'name images')
      .sort({ createdAt: -1 });

    console.log(`[getVendorOrders] Found ${orders.length} orders for vendor ${vendorId}`);
    
    res.status(200).json({
      success: true,
      data: { orders: sanitizeOrdersForVendor(orders.map(o => o.toObject())) },
    });
  } catch (error: any) {
    console.error('[getVendorOrders] Error:', error);
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
      .populate('customer_id', 'email name')
      .populate('assignedVendorId', 'name');
    
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check if vendor owns this order
    if (order.assignedVendorId?.toString() !== vendorId) {
      return next(new AppError('You are not assigned to this order', 403));
    }

    // Map internal status to customer-friendly status
    const statusMap: Record<string, string> = {
      PACKED: 'processing',
      PICKED_UP: 'shipped',
      IN_TRANSIT: 'shipped',
      DELIVERED: 'delivered',
    };

    // Update status
    order.status = status as any;
    await order.save();

    // When order is delivered, credit vendor's wallet with their earnings (purchase price total)
    if (status === 'DELIVERED') {
      try {
        const { WalletService } = await import('../services/WalletService');
        // Sum up purchaseSubtotal for items belonging to this vendor
        const vendorItems = order.items.filter(
          (item: any) => item.vendor_id?.toString() === vendorId
        );
        const vendorEarning = vendorItems.reduce(
          (sum: number, item: any) => sum + (item.purchaseSubtotal || 0),
          0
        );
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
          vendorName
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
    console.error('[updateOrderStatus] Error:', error);
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
    const allowedStatuses = ['PENDING', 'ASSIGNED', 'ACCEPTED', 'REJECTED', 'PACKED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
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

    console.log(`[adminUpdateOrderStatus] Order ${orderId} status updated to ${status} by admin ${req.user._id}`);

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: { order },
    });
  } catch (error: any) {
    console.error('[adminUpdateOrderStatus] Error:', error);
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

    console.log(`[adminAssignOrderToVendor] Order ${orderId} assigned to vendor ${vendorId} by admin ${req.user._id}`);

    res.status(200).json({
      success: true,
      message: 'Order assigned to vendor successfully',
      data: { order },
    });
  } catch (error: any) {
    console.error('[adminAssignOrderToVendor] Error:', error);
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
    console.error('[getOrderShippingDetails] Error:', error);
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
    const platformFee = 10; // Fixed ₹10 for prime orders
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