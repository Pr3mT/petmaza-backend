import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import Order from '../models/Order';
import PrimeProduct from '../models/PrimeProduct';
import VendorDetails from '../models/VendorDetails';
import { AppError } from '../middlewares/errorHandler';
import logger from '../config/logger';
import { sendOrderStatusUpdateEmail, sendOrderRejectionEmail } from '../services/emailer';

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
    };

    if (status) {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await Order.find(query)
      .populate('customer_id', 'name email phone')
      .populate('items.product_id', 'name images')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        orders,
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
    })
      .populate('customer_id', 'name email phone address')
      .populate('items.product_id', 'name images mainCategory subCategory')
      .populate('items.primeProduct_id');

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    res.status(200).json({
      success: true,
      data: { order },
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
    });

    if (!order) {
      return next(new AppError('Order not found or already processed', 404));
    }

    order.status = 'ACCEPTED';
    await order.save();

    // Update prime product stats
    for (const item of order.items) {
      if (item.primeProduct_id) {
        await PrimeProduct.findByIdAndUpdate(item.primeProduct_id, {
          $inc: {
            ordersCount: 1,
            soldQuantity: item.quantity,
          },
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

    // Return stock to prime listing
    for (const item of order.items) {
      if (item.primeProduct_id) {
        await PrimeProduct.findByIdAndUpdate(item.primeProduct_id, {
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
