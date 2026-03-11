import { Request, Response, NextFunction } from 'express';
import { OrderRoutingService } from '../services/OrderRoutingService';
import { OrderAcceptanceService } from '../services/OrderAcceptanceService';
import { ShippingService } from '../services/ShippingService';
import Order from '../models/Order';
import User from '../models/User';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import logger from '../config/logger';
import {
  queueOrderConfirmationEmail,
  queueOrderStatusUpdateEmail,
  queueVendorOrderNotificationEmail,
  queuePaymentSuccessEmail,
} from '../services/emailer';

// Create order (customer)
export const createOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { items, customerPincode, customerAddress } = req.body;

    if (!items || items.length === 0) {
      return next(new AppError('Order must have at least one item', 400));
    }

    if (!customerPincode || !customerAddress) {
      return next(new AppError('Pincode and address are required', 400));
    }

    // Create order through routing service (may return single order or array of split orders)
    const orderResult = await OrderRoutingService.routeOrder({
      customer_id: req.user._id.toString(),
      items,
      customerPincode,
      customerAddress,
    });

    // Handle both single order and split orders
    const orders = Array.isArray(orderResult) ? orderResult : [orderResult];
    const isSplitShipment = orders.length > 1;

    logger.info(`[createOrder] ${orders.length} order(s) created (split: ${isSplitShipment})`);

    // Calculate combined subtotal across all orders
    const combinedSubtotal = orders.reduce((sum, order) => sum + order.total, 0);

    // Calculate shipping charges and platform fee based on combined total
    const charges = await ShippingService.calculateCharges(combinedSubtotal);
    
    // Distribute charges EQUALLY across all orders (50-50 split for 2 orders, etc.)
    // NOT proportionally - each fulfiller gets equal share of fees
    for (const order of orders) {
      order.subtotalBeforeCharges = order.total;
      order.shippingCharges = Math.round(charges.shippingCharges / orders.length);
      order.platformFee = Math.round(charges.platformFee / orders.length);
      order.total = order.subtotalBeforeCharges + order.shippingCharges + order.platformFee;
      await order.save();
    }

    // Populate all orders with product details for email
    const populatedOrders = await Promise.all(
      orders.map(order => order.populate('items.product_id'))
    );

    // Collect all items from all orders for customer email
    const allItems = populatedOrders.flatMap(order => order.items);
    const totalAmount = orders.reduce((sum, order) => sum + order.total, 0);

    // Queue order confirmation email to customer with ALL items (non-blocking)
    logger.info('[createOrder] Queueing order confirmation email to:', req.user.email);
    try {
      const jobId = queueOrderConfirmationEmail(
        req.user.email,
        req.user.name,
        `#${orders[0]._id.toString().slice(-8)}${isSplitShipment ? ` (+${orders.length - 1} more)` : ''}`,
        {
          totalAmount: totalAmount,
          items: allItems, // ALL items from ALL split orders
          customerAddress: orders[0].customerAddress,
          shippingCharges: charges.shippingCharges,
          platformFee: charges.platformFee,
          subtotal: combinedSubtotal,
          isSplitShipment: isSplitShipment,
          splitOrderCount: orders.length,
          splitOrderIds: orders.map(o => `#${o._id.toString().slice(-8)}`),
        }
      );
      logger.info(`[createOrder] ✅ Order confirmation email queued (Job: ${jobId})`);
    } catch (emailError: any) {
      logger.error('[createOrder] ❌ Failed to queue order confirmation email:', emailError.message);
      // Don't fail the order creation if email queueing fails
    }

    // Vendor notifications are already sent in OrderRoutingService

    res.status(201).json({
      success: true,
      message: isSplitShipment 
        ? `Order created successfully! Your items will arrive in ${orders.length} separate shipments.`
        : 'Order created successfully',
      data: { 
        orders,
        isSplitShipment,
        totalAmount,
      },
    });
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
    const { payment_id, payment_status } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check if user owns this order
    let customerId: string;
    if (order.customer_id && typeof order.customer_id === 'object' && '_id' in order.customer_id) {
      customerId = (order.customer_id as any)._id.toString();
    } else {
      customerId = order.customer_id.toString();
    }
    
    if (customerId !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(new AppError('Access denied', 403));
    }

    // Update payment details if provided
    if (payment_id) {
      order.payment_id = payment_id;
    }
    if (payment_status && ['Pending', 'Paid', 'Failed', 'Refunded'].includes(payment_status)) {
      order.payment_status = payment_status;
      
      // Payment completion does NOT change order status to ASSIGNED
      // Order should remain PENDING until vendor accepts it
      // ASSIGNED status is set when vendor accepts the order
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
          const jobId = queuePaymentSuccessEmail(
            customer.email,
            customer.name || 'Customer',
            `#${order._id.toString().slice(-8)}`,
            order.total || 0,
            order.payment_id,
            {
              items: populatedOrder.items,
              customerAddress: order.customerAddress,
              paymentGateway: order.payment_gateway || 'Razorpay',
              paymentMethod: 'Online Payment',
            }
          );
          logger.info(`[updateOrder] ✅ Payment receipt email queued (Job: ${jobId})`);
        } else {
          logger.info('[updateOrder] ⚠️ No customer email found, skipping receipt');
        }
      } catch (emailError: any) {
        logger.error('[updateOrder] ❌ Failed to queue payment receipt:', emailError.message);
        // Don't fail the order update if email queueing fails
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
    const isAdmin = req.user.role === 'admin';
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
      status: { $ne: 'PENDING' }, // Exclude pending orders (those are in pending orders page)
    })
      .populate('customer_id', 'name email phone')
      .populate('items.product_id', 'name images')
      .sort({ createdAt: -1 });

    console.log(`[getVendorOrders] Found ${orders.length} orders for vendor ${vendorId}`);
    
    res.status(200).json({
      success: true,
      data: { orders },
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

    // Queue status update email to customer (non-blocking)
    try {
      const customerEmail = (order.customer_id as any)?.email;
      const customerName = (order.customer_id as any)?.name;
      const vendorName = (order.assignedVendorId as any)?.name;

      if (customerEmail) {
        const jobId = queueOrderStatusUpdateEmail(
          customerEmail,
          customerName || 'Customer',
          orderId,
          statusMap[status] || status.toLowerCase(),
          vendorName
        );
        logger.info(`[updateOrderStatus] Status update email queued (Job: ${jobId})`);
      }
    } catch (emailError: any) {
      logger.error('Failed to queue status update email:', emailError.message);
      // Don't fail the status update if email queueing fails
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