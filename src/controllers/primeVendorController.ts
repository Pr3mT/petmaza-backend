import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import Order from '../models/Order';
import Product from '../models/Product';
import VendorDetails from '../models/VendorDetails';
import { AppError } from '../middlewares/errorHandler';
import logger from '../config/logger';
import { sendOrderStatusUpdateEmail, sendOrderRejectionEmail, sendRefundInitiatedEmail } from '../services/emailer';
import { sanitizeOrderForVendor, sanitizeOrdersForVendor } from '../utils/vendorOrderSanitizer';

/**
 * Fix orders where purchasePrice was stored as 0.
 * After unification, reads purchasePrice directly from the Product document.
 */
async function enrichMissingPurchasePrices(orderObjects: any[], vendorId: string): Promise<any[]> {
  return Promise.all(orderObjects.map(async (order) => {
    if (!Array.isArray(order.items)) return order;

    let needsRecalc = false;
    const enrichedItems = await Promise.all(order.items.map(async (item: any) => {
      if (item.purchasePrice && item.purchasePrice > 0) return item;

      needsRecalc = true;

      // Read purchasePrice directly from the populated product object if available
      let price = 0;
      if (item.product_id && typeof item.product_id === 'object') {
        price = (item.product_id as any).purchasePrice || 0;
      }

      // Otherwise look it up from the DB
      if (!price) {
        const productId = item.product_id?._id?.toString() || item.product_id?.toString();
        if (productId) {
          const product = await Product.findById(productId).select('purchasePrice sellingPrice').lean();
          price = (product as any)?.purchasePrice || 0;
        }
      }

      // If purchasePrice is still 0 after DB lookup, do NOT fall back to sellingPrice.
      // Showing sellingPrice as payout would leak customer pricing to the vendor.
      // The admin must correctly set purchasePrice on the product.
      if (!price) return item;

      return {
        ...item,
        purchasePrice: price,
        purchaseSubtotal: price * item.quantity,
      };
    }));

    if (!needsRecalc) return order;

    const totalPurchasePrice = enrichedItems.reduce(
      (sum: number, i: any) => sum + (i.purchaseSubtotal || i.purchasePrice * i.quantity || 0), 0
    );

    return { ...order, items: enrichedItems, totalPurchasePrice };
  }));
}

// Get Prime Vendor Orders
export const getPrimeVendorOrders = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendor_id = req.user._id;
    const { status, page = 1, limit = 20 } = req.query;

    const query: any = {
      assignedVendorId: vendor_id,
      isPrime: true,
      payment_status: 'Paid',
    };

    if (status) {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await Order.find(query)
      .populate('customer_id', 'name email phone')
      .populate('items.product_id', 'name images purchasePrice')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments(query);

    const rawOrders = await enrichMissingPurchasePrices(
      orders.map(o => o.toObject()),
      vendor_id.toString()
    );

    res.status(200).json({
      success: true,
      data: {
        orders: sanitizeOrdersForVendor(rawOrders),
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit),
        },
      },
    });
  } catch (error: any) {
    logger.error('[PrimeVendor] Error fetching orders:', error);
    next(error);
  }
};

// Get Single Order Details
export const getPrimeOrderDetails = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendor_id = req.user._id;
    const { id } = req.params;

    const order = await Order.findOne({
      _id: id,
      assignedVendorId: vendor_id,
      isPrime: true,
      payment_status: 'Paid',
    })
      .populate('customer_id', 'name email phone address')
      .populate('items.product_id', 'name images mainCategory subCategory purchasePrice')
;

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    const [enriched] = await enrichMissingPurchasePrices(
      [order.toObject()],
      vendor_id.toString()
    );

    res.status(200).json({
      success: true,
      data: { order: sanitizeOrderForVendor(enriched) },
    });
  } catch (error: any) {
    logger.error('[PrimeVendor] Error fetching order details:', error);
    next(error);
  }
};

// Accept Prime Order
export const acceptPrimeOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendor_id = req.user._id;
    const { id } = req.params;

    const order = await Order.findOne({
      _id: id,
      assignedVendorId: vendor_id,
      isPrime: true,
      status: 'PENDING',
      payment_status: 'Paid',
    });

    if (!order) {
      return next(new AppError('Order not found or already processed', 404));
    }

    order.status = 'ACCEPTED';
    await order.save();

    // Update prime product stats directly on the Product document
    for (const item of order.items) {
      const productId = (item.product_id as any)?._id || item.product_id;
      if (productId) {
        await Product.findByIdAndUpdate(productId, {
          $inc: { ordersCount: 1, soldQuantity: item.quantity },
        });
      }
    }

    // Update vendor stats
    await VendorDetails.findOneAndUpdate(
      { vendor_id },
      {
        $inc: { totalOrders: 1 },
      }
    );

    logger.info(`[PrimeVendor] Order ${id} accepted by vendor ${vendor_id}`);

    // Send email to customer
    try {
      const populatedOrder = await order.populate('customer_id');
      const customer = populatedOrder.customer_id as any;
      
      if (customer?.email) {
        const orderId = order._id.toString().slice(-8).toUpperCase();
        await sendOrderStatusUpdateEmail(
          customer.email,
          customer.name,
          orderId,
          'ACCEPTED',
          undefined // Don't show vendor name in email
        );
      }
    } catch (emailError) {
      logger.error('[PrimeVendor] Failed to send order accepted email:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Prime order accepted successfully',
      data: { order },
    });
  } catch (error: any) {
    logger.error('[PrimeVendor] Error accepting order:', error);
    next(error);
  }
};

// Reject Prime Order
export const rejectPrimeOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendor_id = req.user._id;
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findOne({
      _id: id,
      assignedVendorId: vendor_id,
      isPrime: true,
      status: { $in: ['PENDING', 'ASSIGNED', 'ACCEPTED'] }, // Allow rejection of PENDING, ASSIGNED, and ACCEPTED orders
    }).populate('customer_id', 'name email');

    if (!order) {
      return next(new AppError('Order not found or already processed', 404));
    }

    order.status = 'REJECTED';
    order.rejectionReason = reason || 'Vendor rejected the order';
    await order.save();

    // Return stock to the Product document
    for (const item of order.items) {
      const productId = (item.product_id as any)?._id || item.product_id;
      if (productId) {
        await Product.findByIdAndUpdate(productId, {
          $inc: { stock: item.quantity },
        });
      }
    }

    logger.info(`[PrimeVendor] Order ${id} rejected by vendor ${vendor_id}`);

    // Send rejection email with refund notification to customer
    try {
      const orderId = order._id.toString().slice(-8).toUpperCase();
      
      // Check if customer_id is populated (has email property)
      const customer = order.customer_id as any;
      const customerEmail = customer?.email;
      const customerName = customer?.name;
      
      logger.info(`[PrimeVendor] Customer data - Email: ${customerEmail}, Name: ${customerName}`);
      
      if (customerEmail && customerName) {
        sendOrderRejectionEmail(
          customerEmail,
          customerName,
          orderId,
          reason || 'Vendor rejected the order',
          order.total || 0
        ).then(() => logger.info(`[PrimeVendor] Rejection email sent for order ${orderId} to ${customerEmail}`))
         .catch((e: any) => logger.error(`[PrimeVendor] Rejection email failed: ${e.message}`));
      } else {
        logger.error(`[PrimeVendor] Cannot send rejection email - Missing customer data. Email: ${customerEmail}, Name: ${customerName}`);
      }
    } catch (emailError: any) {
      logger.error(`[PrimeVendor] Error sending rejection email: ${emailError.message}`);
      // Don't fail the rejection if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Prime order rejected successfully',
      data: { order },
    });
  } catch (error: any) {
    logger.error('[PrimeVendor] Error rejecting order:', error);
    next(error);
  }
};

// Update Prime Order Status
export const updatePrimeOrderStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendor_id = req.user._id;
    const { id } = req.params;
    const { status, trackingNumber } = req.body;

    const order = await Order.findOne({
      _id: id,
      assignedVendorId: vendor_id,
      isPrime: true,
    });

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    const allowedStatuses = ['ACCEPTED', 'PROCESSING', 'PACKED', 'PICKED_UP', 'IN_TRANSIT', 'SHIPPED', 'DELIVERED'];
    if (!allowedStatuses.includes(status)) {
      return next(new AppError('Invalid status', 400));
    }

    order.status = status;
    if (trackingNumber) {
      if (!order.courier) order.courier = {};
      order.courier.tracking_id = trackingNumber;
    }
    
    if (status === 'DELIVERED') {
      order.deliveredAt = new Date();
      
      // Update vendor completed orders count
      await VendorDetails.findOneAndUpdate(
        { vendor_id },
        {
          $inc: {
            completedOrders: 1,
            totalPrimeSales: order.total,
          },
        }
      );
    }

    await order.save();

    logger.info(`[PrimeVendor] Order ${id} status updated to ${status} by vendor ${vendor_id}`);

    // Send email to customer - ONLY for SHIPPED and DELIVERED
    // Customer receives only 3 emails: ACCEPTED, SHIPPED, DELIVERED
    const emailStatuses = ['SHIPPED', 'DELIVERED'];
    if (emailStatuses.includes(status)) {
      try {
        const populatedOrder = await order.populate('customer_id');
        const customer = populatedOrder.customer_id as any;
        
        if (customer?.email) {
          const orderId = order._id.toString().slice(-8).toUpperCase();
          await sendOrderStatusUpdateEmail(
            customer.email,
            customer.name,
            orderId,
            order.status,
            undefined // Don't show vendor name in email
          );
        }
      } catch (emailError) {
        logger.error('[PrimeVendor] Failed to send order status update email:', emailError);
      }
    } else {
      logger.info(`[PrimeVendor] Skipping email for status ${status} (only SHIPPED and DELIVERED trigger emails)`);
    }

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: { order },
    });
  } catch (error: any) {
    logger.error('[PrimeVendor] Error updating order status:', error);
    next(error);
  }
};

// Mark Prime Order as Not Available (product out of stock)
export const markNotAvailable = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendor_id = req.user._id;
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findOne({
      _id: id,
      assignedVendorId: vendor_id,
      isPrime: true,
      status: { $in: ['PENDING', 'ASSIGNED'] },
      payment_status: 'Paid',
    }).populate('customer_id', 'name email');

    if (!order) {
      return next(new AppError('Order not found or cannot be marked as not available', 404));
    }

    order.status = 'NOT_AVAILABLE';
    order.rejectionReason = reason || 'Product is currently out of stock';
    await order.save();

    // Restore stock
    for (const item of order.items) {
      const productId = (item.product_id as any)?._id || item.product_id;
      if (productId) {
        await Product.findByIdAndUpdate(productId, {
          $inc: { stock: item.quantity },
        });
      }
    }

    logger.info(`[PrimeVendor] Order ${id} marked NOT_AVAILABLE by vendor ${vendor_id}`);

    res.status(200).json({
      success: true,
      message: 'Order marked as not available. Please initiate refund.',
      data: { order },
    });
  } catch (error: any) {
    logger.error('[PrimeVendor] Error marking order not available:', error);
    next(error);
  }
};

// Initiate Refund for a Prime Order (one-step: works from PENDING, ASSIGNED, or NOT_AVAILABLE)
export const initiateRefund = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendor_id = req.user._id;
    const { id } = req.params;

    const order = await Order.findOne({
      _id: id,
      assignedVendorId: vendor_id,
      isPrime: true,
      status: { $in: ['PENDING', 'ASSIGNED', 'NOT_AVAILABLE'] },
    }).populate('customer_id', 'name email');

    if (!order) {
      return next(new AppError('Order not found or not eligible for refund.', 404));
    }

    // Restore stock (if not already done)
    if (order.status !== 'NOT_AVAILABLE') {
      for (const item of order.items) {
        const productId = (item.product_id as any)?._id || item.product_id;
        if (productId) {
          await Product.findByIdAndUpdate(productId, {
            $inc: { stock: item.quantity },
          });
        }
      }
    }

    order.status = 'REFUND_INITIATED';
    order.refundStatus = 'PENDING';
    order.refundAmount = order.total;  // full amount customer paid
    order.refundReason = 'Product not available from vendor';
    await order.save();

    logger.info(`[PrimeVendor] Refund initiated for order ${id} by vendor ${vendor_id}`);

    // Send refund email to customer
    try {
      const customer = order.customer_id as any;
      if (customer?.email && customer?.name) {
        const orderId = order._id.toString().slice(-8).toUpperCase();
        await sendRefundInitiatedEmail(
          customer.email,
          customer.name,
          orderId,
          order.total || 0,
          order.refundReason || 'Product not available'
        );
        logger.info(`[PrimeVendor] Refund email sent to ${customer.email} for order ${orderId}`);
      }
    } catch (emailError: any) {
      logger.error(`[PrimeVendor] Failed to send refund email: ${emailError.message}`);
      // Don't fail the refund if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Refund initiated successfully. Customer has been notified via email.',
      data: { order },
    });
  } catch (error: any) {
    logger.error('[PrimeVendor] Error initiating refund:', error);
    next(error);
  }
};
