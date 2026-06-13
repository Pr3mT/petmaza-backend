import logger from '../config/logger';
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import Order from '../models/Order';
import User from '../models/User';
import ShippingDetails from '../models/ShippingDetails';
import { AppError } from '../middlewares/errorHandler';
import { sanitizeOrdersForVendor, sanitizeOrderForVendor } from '../utils/vendorOrderSanitizer';
import cloudinary from '../config/cloudinary';
import streamifier from 'streamifier';
import { applyVendorPriceAdjustments } from '../utils/applyVendorPriceAdjustments';
import { 
  sendOrderAcceptedEmail, 
  sendOrderShippedEmail,
  sendDeliveryCompletedEmail,
  sendRefundInitiatedEmail,
  sendAdminDeliveryNotificationEmail
} from '../services/emailer';

/**
 * Get all orders for MY_SHOP vendor
 */
export const getMyShopOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vendor = req.user;

    if (vendor.vendorType !== 'MY_SHOP') {
      return next(new AppError('Access denied. Only MY_SHOP vendors can access this.', 403));
    }

    // MY_SHOP manager sees ALL orders:
    // 1. Orders directly assigned to them
    // 2. Prime product orders (isPrime: true)
    // 3. Broadcast warehouse fulfiller orders not yet claimed (assignedVendorId: null)
    const orders = await Order.find({
      payment_status: 'Paid',
      $or: [
        { assignedVendorId: vendor._id },
        { isPrime: true },
        { assignedVendorId: null },
      ],
    })
      .populate('customer_id', 'name email phone')
      .populate('items.product_id', 'name images')
      .sort({ createdAt: -1 });

    // Sanitize vendor-sensitive pricing but preserve customerPaidTotal
    // grandTotal = full customer payment (item subtotal + fees - discount)
    // For createPrimeOrder: total = item subtotal, grandTotal = item + fees
    // For createOrder (normal): total = grandTotal = item + fees
    // For old orders where grandTotal wasn't set: reconstruct from parts
    const sanitized = orders.map(o => {
      const plain = o.toObject();
      const sanitizedOrder = sanitizeOrderForVendor(plain);
      // Use grandTotal if properly set; otherwise reconstruct: total + platformFee + shippingCharges - discountAmount
      const grandTotal = (plain.grandTotal ?? 0);
      const reconstructed =
        (plain.total || 0) +
        (plain.shippingCharges || 0) +
        (plain.platformFee || 0) -
        (plain.discountAmount || 0);
      sanitizedOrder.customerPaidTotal = grandTotal > 0 ? grandTotal : Math.max(reconstructed, plain.total || 0);
      return sanitizedOrder;
    });

    res.status(200).json({
      success: true,
      data: { orders: sanitized },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Accept order by MY_SHOP vendor
 */
export const acceptOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const vendor = req.user;

    logger.info('[myShop:acceptOrder] Request received:', {
      orderId,
      userId: vendor?._id,
      userRole: vendor?.role,
      vendorType: vendor?.vendorType,
    });

    if (vendor.vendorType !== 'MY_SHOP') {
      logger.info('[myShop:acceptOrder] Access denied - not a MY_SHOP vendor');
      return next(new AppError('Access denied. Only MY_SHOP vendors can accept orders.', 403));
    }

    const order = await Order.findById(orderId);

    if (!order) {
      logger.info('[myShop:acceptOrder] Order not found:', orderId);
      return next(new AppError('Order not found', 404));
    }

    logger.info('[myShop:acceptOrder] Order found:', {
      orderId: order._id,
      status: order.status,
      assignedVendorId: order.assignedVendorId,
    });

    if (order.assignedVendorId?.toString() !== vendor._id.toString()) {
      logger.info('[myShop:acceptOrder] Order not assigned to this vendor');
      return next(new AppError('This order is not assigned to you', 403));
    }

    if (order.status !== 'PENDING') {
      logger.info('[myShop:acceptOrder] Order not pending:', order.status);
      return next(new AppError(`Order is already ${order.status}`, 400));
    }

    if (order.payment_status !== 'Paid') {
      logger.info('[myShop:acceptOrder] Order payment is not completed:', order.payment_status);
      return next(new AppError('Order cannot be accepted before successful payment', 400));
    }

    // Record sales when MY_SHOP accepts (all products in Products collection)
    const { SalesService } = await import('../services/SalesService');

    for (const item of order.items) {
      try {
        await SalesService.recordSale({
          vendor_id: vendor._id.toString(),
          product_id: item.product_id.toString(),
          quantity: item.quantity,
          saleType: 'WEBSITE',
          soldBy: vendor._id.toString(),
          order_id: order._id.toString(),
          sellingPrice: item.sellingPrice,
          selectedVariant: item.selectedVariant,
        });
      } catch (error: any) {
        // Log error but don't fail order acceptance
        logger.error(`Failed to record sale for product ${item.product_id}:`, error);
      }
    }

    // Apply any vendor-adjusted purchase prices submitted with the acceptance.
    const adj = applyVendorPriceAdjustments(order.items as any, req.body?.priceUpdates);
    if (adj.changed) {
      order.totalPurchasePrice = adj.totalPurchasePrice;
      order.totalProfit = adj.totalProfit;
      order.markModified('items');
      logger.info(`[myShop:acceptOrder] Vendor adjusted prices on order ${orderId}. New totalPurchasePrice=${adj.totalPurchasePrice}`);
    }

    order.status = 'ACCEPTED';
    await order.save();

    logger.info(`[myShop:acceptOrder] Order ${orderId} accepted successfully by ${vendor._id}`);

    // Send email to customer
    logger.info('[myShop:acceptOrder] Starting email send process...');
    try {
      const populatedOrder = await order.populate('customer_id');
      const customer = populatedOrder.customer_id as any;
      
      logger.info('[myShop:acceptOrder] Customer populated:', {
        customerId: customer?._id,
        email: customer?.email,
        name: customer?.name
      });
      
      if (customer?.email) {
        logger.info('[myShop:acceptOrder] Sending order accepted email to:', customer.email);
        await sendOrderAcceptedEmail(
          customer.email,
          customer.name || 'Customer',
          `#${order._id.toString().slice(-8)}`,
          vendor.name || 'Shop Manager',
          '2-5 business days'
        );
        logger.info('[myShop:acceptOrder] ✅ Order accepted email sent successfully!');
      } else {
        logger.info('[myShop:acceptOrder] ⚠️ No customer email found, skipping email');
      }
    } catch (emailError: any) {
      logger.error('[myShop:acceptOrder] ❌ Failed to send order accepted email:', emailError.message);
      logger.error('[myShop:acceptOrder] Email error stack:', emailError.stack);
    }

    res.status(200).json({
      success: true,
      message: 'Order accepted successfully',
      data: { order },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Refund order if MY_SHOP vendor cannot fulfill
 */
export const refundOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const vendor = req.user;

    logger.info('[myShop:refundOrder] Request received:', {
      orderId,
      vendorId: vendor._id,
      reason,
    });

    if (vendor.vendorType !== 'MY_SHOP') {
      return next(new AppError('Access denied. Only MY_SHOP vendors can refund orders.', 403));
    }

    const order = await Order.findById(orderId).populate('customer_id', 'name email');

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.assignedVendorId?.toString() !== vendor._id.toString()) {
      return next(new AppError('This order is not assigned to you', 403));
    }

    if (!['PENDING', 'ACCEPTED'].includes(order.status)) {
      return next(
        new AppError(`Cannot refund order that is already ${order.status}`, 400)
      );
    }

    // If order was accepted, need to reverse the sales/stock changes
    if (order.status === 'ACCEPTED') {
      const { SalesService } = await import('../services/SalesService');
      
      for (const item of order.items) {
        try {
          // Reverse the sale (add stock back)
          await SalesService.reverseSale({
            vendor_id: vendor._id.toString(),
            product_id: item.product_id.toString(),
            quantity: item.quantity,
            order_id: order._id.toString(),
            selectedVariant: item.selectedVariant,
          });
        } catch (error) {
          logger.error(`Failed to reverse sale for product ${item.product_id}:`, error);
        }
      }
    }

    // Process refund
    order.status = 'REFUND_INITIATED';
    order.refundReason = reason || 'Unable to fulfill order';
    order.refundedAt = new Date();
    
    // If payment was made, mark for refund processing
    // Use grandTotal (includes platform fee + shipping) = actual customer payment
    // Reconstruct if grandTotal not set: total + platformFee + shippingCharges - discountAmount
    if (order.payment_status === 'Paid') {
      order.refundStatus = 'PENDING';
      const gt = (order.grandTotal ?? 0);
      const reconstructedTotal =
        (order.total || 0) +
        (order.shippingCharges || 0) +
        (order.platformFee || 0) -
        (order.discountAmount || 0);
      order.refundAmount = gt > 0 ? gt : Math.max(reconstructedTotal, order.total || 0);
    }

    await order.save();

    logger.info(`Order ${orderId} refunded by MY_SHOP vendor ${vendor._id}. Reason: ${reason || 'None provided'}`);

    // Send refund initiated email to customer
    let emailError: string | null = null;
    try {
      const customer = order.customer_id as any;
      if (customer?.email) {
        await sendRefundInitiatedEmail(
          customer.email,
          customer.name || 'Customer',
          `#${order._id.toString().slice(-8)}`,
          order.refundAmount || order.total || 0,
          order.refundReason || 'Product not available'
        );
        logger.info(`[myShop:refundOrder] Refund email sent to ${customer.email}`);
      } else {
        logger.warn('[myShop:refundOrder] No customer email found — skipping refund email');
      }
    } catch (err: any) {
      emailError = err.message;
      logger.error('[myShop:refundOrder] Failed to send refund email:', err.message);
    }

    res.status(200).json({
      success: true,
      message: 'Order refund initiated successfully',
      emailSent: !emailError,
      ...(emailError ? { emailError } : {}),
      data: { order },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Mark order as packed
 */
export const markPacked = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const vendor = req.user;

    if (vendor.vendorType !== 'MY_SHOP') {
      return next(new AppError('Access denied.', 403));
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.assignedVendorId?.toString() !== vendor._id.toString()) {
      return next(new AppError('This order is not assigned to you', 403));
    }

    if (order.status !== 'ACCEPTED') {
      return next(new AppError(`Cannot pack order that is ${order.status}`, 400));
    }

    order.status = 'PACKED';
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order marked as packed',
      data: { order },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Mark order as picked up by delivery
 */
export const markPickedUp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const vendor = req.user;

    if (vendor.vendorType !== 'MY_SHOP') {
      return next(new AppError('Access denied.', 403));
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.assignedVendorId?.toString() !== vendor._id.toString()) {
      return next(new AppError('This order is not assigned to you', 403));
    }

    if (order.status !== 'PACKED') {
      return next(new AppError(`Cannot mark as picked up from status ${order.status}`, 400));
    }

    order.status = 'PICKED_UP';
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order marked as picked up',
      data: { order },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Mark order as in transit
 */
export const markInTransit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const vendor = req.user;

    if (vendor.vendorType !== 'MY_SHOP') {
      return next(new AppError('Access denied.', 403));
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.assignedVendorId?.toString() !== vendor._id.toString()) {
      return next(new AppError('This order is not assigned to you', 403));
    }

    if (order.status !== 'PICKED_UP') {
      return next(new AppError(`Cannot mark as in transit from status ${order.status}`, 400));
    }

    // ── Full shipping details are REQUIRED to ship (same as Prime Vendor flow) ──
    const courierName = String(
      req.body.shipping_company || req.body.courier_name || req.body.courier || ''
    ).trim();
    const trackingId = String(req.body.tracking_id || req.body.trackingNumber || '').trim();
    const { total_weight, weight_unit, delivery_type } = req.body;

    if (!courierName) {
      return next(new AppError('Courier / shipping company name is required to mark the order in transit.', 400));
    }
    if (!trackingId) {
      return next(new AppError('Tracking ID is required to mark the order in transit.', 400));
    }
    if (!total_weight || isNaN(Number(total_weight)) || Number(total_weight) <= 0) {
      return next(new AppError('Total weight must be a positive number', 400));
    }
    if (!weight_unit || !['kg', 'g'].includes(weight_unit)) {
      return next(new AppError('Weight unit must be kg or g', 400));
    }
    if (!delivery_type || !['inter_state', 'out_of_state'].includes(delivery_type)) {
      return next(new AppError('Delivery type must be inter_state or out_of_state', 400));
    }
    if (!req.file) {
      return next(new AppError('Shipping receipt file is required', 400));
    }

    // ── Prevent duplicate shipping details for this order ──────────────────────
    const existing = await ShippingDetails.findOne({ order_id: orderId });
    if (existing) {
      return next(new AppError('Shipping details already submitted for this order', 409));
    }

    // ── Upload receipt to Cloudinary ───────────────────────────────────────────
    const isPdf = req.file.mimetype === 'application/pdf';
    const uploadResult: any = await new Promise((resolve, reject) => {
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

    // ── Save shipping details ──────────────────────────────────────────────────
    await ShippingDetails.create({
      order_id: orderId,
      vendor_id: vendor._id,
      shipping_company: courierName,
      receipt_file_url: uploadResult.secure_url,
      receipt_file_public_id: uploadResult.public_id,
      tracking_id: trackingId,
      total_weight: Number(total_weight),
      weight_unit,
      delivery_type,
    });

    if (!order.courier) order.courier = {};
    order.courier.name = courierName;
    order.courier.tracking_id = trackingId;

    order.status = 'IN_TRANSIT';
    await order.save();

    // Send order shipped email to customer
    try {
      const populatedOrder = await order.populate('customer_id');
      const customer = populatedOrder.customer_id as any;
      if (customer?.email) {
        await sendOrderShippedEmail(
          customer.email,
          customer.name || 'Customer',
          `#${order._id.toString().slice(-8)}`,
          `${courierName} - ${trackingId}`,
          '1-3 business days'
        );
      }
    } catch (emailError: any) {
      logger.error('Failed to send order shipped email:', emailError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Order marked as in transit',
      data: { order },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Mark order as delivered
 */
export const markDelivered = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const vendor = req.user;

    if (vendor.vendorType !== 'MY_SHOP') {
      return next(new AppError('Access denied.', 403));
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.assignedVendorId?.toString() !== vendor._id.toString()) {
      return next(new AppError('This order is not assigned to you', 403));
    }

    if (order.status !== 'IN_TRANSIT') {
      return next(new AppError(`Cannot mark as delivered from status ${order.status}`, 400));
    }

    order.status = 'DELIVERED';
    order.deliveredAt = new Date();
    await order.save();

    logger.info(`[myShop:markDelivered] Order ${orderId} marked as DELIVERED by ${vendor._id}`);

    // Send delivery completed email to customer
    logger.info('[myShop:markDelivered] Starting customer email send process...');
    try {
      const populatedOrder = await order.populate('customer_id');
      const customer = populatedOrder.customer_id as any;
      
      logger.info('[myShop:markDelivered] Customer populated:', {
        customerId: customer?._id,
        email: customer?.email,
        name: customer?.name
      });
      
      if (customer?.email) {
        logger.info('[myShop:markDelivered] Sending delivery completed email to:', customer.email);
        await sendDeliveryCompletedEmail(
          customer.email,
          customer.name || 'Customer',
          `#${order._id.toString().slice(-8)}`,
          new Date().toLocaleDateString('en-IN', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
          })
        );
        logger.info('[myShop:markDelivered] ✅ Delivery completed email sent successfully!');
      } else {
        logger.info('[myShop:markDelivered] ⚠️ No customer email found, skipping email');
      }
    } catch (emailError: any) {
      logger.error('[myShop:markDelivered] ❌ Failed to send delivery completed email:', emailError.message);
      logger.error('[myShop:markDelivered] Email error stack:', emailError.stack);
    }

    // Send admin notification for delivered order
    logger.info('[myShop:markDelivered] Starting admin notification process...');
    try {
      const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
      logger.info('[myShop:markDelivered] Admin emails:', adminEmails);
      
      const populatedOrder = await order.populate(['customer_id', 'items.product_id']);
      const customer = populatedOrder.customer_id as any;
      
      logger.info('[myShop:markDelivered] Sending admin notifications to', adminEmails.length, 'admins');
      
      for (const adminEmail of adminEmails) {
        await sendAdminDeliveryNotificationEmail(
          adminEmail.trim(),
          `#${order._id.toString().slice(-8)}`,
          {
            customerName: customer?.name || 'Customer',
            totalAmount: order.total,
            items: populatedOrder.items,
            deliveredAt: order.deliveredAt?.toLocaleString('en-IN') || new Date().toLocaleString('en-IN'),
            vendorName: vendor.name || 'MyShop Vendor',
          }
        );
      }
      logger.info('[myShop:markDelivered] ✅ Admin delivery notifications sent successfully');
    } catch (emailError: any) {
      logger.error('[myShop:markDelivered] ❌ Failed to send admin delivery notification:', emailError.message);
      logger.error('[myShop:markDelivered] Admin email error stack:', emailError.stack);
    }

    res.status(200).json({
      success: true,
      message: 'Order marked as delivered',
      data: { order },
    });
  } catch (error: any) {
    next(error);
  }
};
