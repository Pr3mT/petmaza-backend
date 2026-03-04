import { Request, Response, NextFunction } from 'express';
import { OrderRoutingService } from '../services/OrderRoutingService';
import { OrderAcceptanceService } from '../services/OrderAcceptanceService';
import { ShippingService } from '../services/ShippingService';
import Order from '../models/Order';
import User from '../models/User';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import {
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendVendorOrderNotificationEmail,
  sendPaymentSuccessEmail,
} from '../services/emailer';

// Helper function to send emails asynchronously (non-blocking)
const sendEmailAsync = (emailPromise: Promise<any>, description: string) => {
  emailPromise
    .then(() => console.log(`[Email] ✅ ${description} sent successfully`))
    .catch((error) => console.error(`[Email] ❌ Failed to send ${description}:`, error.message));
};

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

    // Create order through routing service
    const order = await OrderRoutingService.routeOrder({
      customer_id: req.user._id.toString(),
      items,
      customerPincode,
      customerAddress,
    });

    // Calculate shipping charges and platform fee
    const charges = await ShippingService.calculateCharges(order.total);
    
    // Update order with charges
    order.subtotalBeforeCharges = order.total;
    order.shippingCharges = charges.shippingCharges;
    order.platformFee = charges.platformFee;
    order.total = charges.total;
    await order.save();

    // Send emails asynchronously (non-blocking) - populate order data first
    const populatedOrder = await order.populate('items.product_id');
    
    // Send order confirmation email to customer (async)
    sendEmailAsync(
      sendOrderConfirmationEmail(
        req.user.email,
        req.user.name,
        `#${order._id.toString().slice(-8)}`,
        {
          totalAmount: order.total,
          items: populatedOrder.items,
          customerAddress: order.customerAddress,
          shippingCharges: order.shippingCharges,
          platformFee: order.platformFee,
          subtotal: order.subtotalBeforeCharges,
        }
      ),
      'Order confirmation email'
    );

    // Send vendor notification if order is assigned (async)
    if (order.assignedVendorId) {
      User.findById(order.assignedVendorId).then((vendor) => {
        if (vendor) {
          sendEmailAsync(
            sendVendorOrderNotificationEmail(
              vendor.email,
              vendor.name,
              `#${order._id.toString().slice(-8)}`,
              {
                customerName: req.user.name,
                customerAddress: order.customerAddress,
                customerPincode: order.customerPincode,
                totalAmount: order.total,
                items: populatedOrder.items,
              }
            ),
            'Vendor notification email'
          );
        }
      }).catch(err => console.error('[Email] Error fetching vendor:', err.message));
    }

    // Return response immediately without waiting for emails
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order },
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

    // Send payment receipt email when payment is completed
    if (payment_status === 'Paid') {
      console.log('[updateOrder] Payment completed, sending receipt email...');
      try {
        const populatedOrder = await order.populate(['customer_id', 'items.product_id']);
        const customer = populatedOrder.customer_id as any;
        
        console.log('[updateOrder] Customer details:', {
          email: customer?.email,
          name: customer?.name,
          orderId: order._id,
          amount: order.total,
          paymentId: order.payment_id,
        });

        if (customer?.email) {
          console.log('[updateOrder] Sending payment receipt to:', customer.email);
          await sendPaymentSuccessEmail(
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
          console.log('[updateOrder] ✅ Payment receipt email sent successfully!');
        } else {
          console.log('[updateOrder] ⚠️ No customer email found, skipping receipt');
        }
      } catch (emailError: any) {
        console.error('[updateOrder] ❌ Failed to send payment receipt:', emailError.message);
        console.error('[updateOrder] Email error stack:', emailError.stack);
        // Don't fail the order update if email fails
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

    // Send status update email to customer
    try {
      const customerEmail = (order.customer_id as any)?.email;
      const customerName = (order.customer_id as any)?.name;
      const vendorName = (order.assignedVendorId as any)?.name;

      if (customerEmail) {
        await sendOrderStatusUpdateEmail(
          customerEmail,
          customerName || 'Customer',
          orderId,
          statusMap[status] || status.toLowerCase(),
          vendorName
        );
      }
    } catch (emailError: any) {
      console.error('Failed to send status update email:', emailError.message);
      // Don't fail the status update if email fails
    }

    console.log(`[updateOrderStatus] Order ${orderId} status updated to ${status} by vendor ${vendorId}`);

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