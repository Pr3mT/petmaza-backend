import { Response, NextFunction } from 'express';
import Order from '../models/Order';
import User from '../models/User';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { 
  sendOrderAcceptedEmail, 
  sendOrderRejectedEmail, 
  sendOrderShippedEmail,
  sendDeliveryCompletedEmail,
  sendAdminDeliveryNotificationEmail
} from '../services/emailer';

/**
 * Get orders assigned to warehouse fulfiller
 */
export const getWarehouseFulfillerOrders = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const fulfiller = req.user;

    if (fulfiller.vendorType !== 'WAREHOUSE_FULFILLER') {
      return next(new AppError('Access denied. Only warehouse fulfillers can access this.', 403));
    }

    const orders = await Order.find({
      assignedVendorId: fulfiller._id,
      status: {
        $in: [
          'PENDING',
          'ACCEPTED',
          'PICKED_FROM_VENDOR',
          'PACKED',
          'PICKED_UP',
          'IN_TRANSIT',
          'DELIVERED',
        ],
      },
    })
      .populate('customer_id', 'name email phone')
      .populate('items.product_id', 'name images')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { orders },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Accept order by warehouse fulfiller
 */
export const acceptOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const fulfiller = req.user;

    console.log('[acceptOrder] Request received:', {
      orderId,
      userId: fulfiller?._id,
      userRole: fulfiller?.role,
      vendorType: fulfiller?.vendorType,
    });

    if (fulfiller.vendorType !== 'WAREHOUSE_FULFILLER') {
      console.log('[acceptOrder] Access denied - not a warehouse fulfiller');
      return next(new AppError('Access denied. Only warehouse fulfillers can accept orders.', 403));
    }

    const order = await Order.findById(orderId);

    if (!order) {
      console.log('[acceptOrder] Order not found:', orderId);
      return next(new AppError('Order not found', 404));
    }

    console.log('[acceptOrder] Order found:', {
      orderId: order._id,
      status: order.status,
      assignedVendorId: order.assignedVendorId,
    });

    if (order.assignedVendorId?.toString() !== fulfiller._id.toString()) {
      console.log('[acceptOrder] Order not assigned to this fulfiller');
      return next(new AppError('This order is not assigned to you', 403));
    }

    if (order.status !== 'PENDING') {
      console.log('[acceptOrder] Order not pending:', order.status);
      return next(new AppError(`Order is already ${order.status}`, 400));
    }

    order.status = 'ACCEPTED';
    await order.save();

    console.log(`[acceptOrder] Order ${orderId} accepted successfully by ${fulfiller._id}`);

    // Send email to customer
    try {
      console.log('[acceptOrder] Starting email send process...');
      const populatedOrder = await order.populate('customer_id');
      const customer = populatedOrder.customer_id as any;
      console.log('[acceptOrder] Customer populated:', {
        customerId: customer?._id,
        email: customer?.email,
        name: customer?.name,
      });
      
      if (customer?.email) {
        console.log('[acceptOrder] Sending order accepted email to:', customer.email);
        await sendOrderAcceptedEmail(
          customer.email,
          customer.name || 'Customer',
          `#${order._id.toString().slice(-8)}`,
          fulfiller.name || 'Warehouse',
          '2-5 business days'
        );
        console.log('[acceptOrder] ✅ Order accepted email sent successfully!');
      } else {
        console.log('[acceptOrder] ⚠️ Customer email not found, skipping email');
      }
    } catch (emailError: any) {
      console.error('[acceptOrder] ❌ Failed to send order accepted email:', emailError.message);
      console.error('[acceptOrder] Email error stack:', emailError.stack);
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
 * Reject order and reassign to MY_SHOP vendor
 */
export const rejectAndReassign = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const fulfiller = req.user;

    if (fulfiller.vendorType !== 'WAREHOUSE_FULFILLER') {
      return next(new AppError('Access denied. Only warehouse fulfillers can reject orders.', 403));
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.assignedVendorId?.toString() !== fulfiller._id.toString()) {
      return next(new AppError('This order is not assigned to you', 403));
    }

    if (!['PENDING', 'ACCEPTED'].includes(order.status)) {
      return next(
        new AppError(`Cannot reject order that is already ${order.status}`, 400)
      );
    }

    // Find MY_SHOP vendor
    const myShopVendor = await User.findOne({
      role: 'vendor',
      vendorType: 'MY_SHOP',
      isApproved: true,
    });

    if (!myShopVendor) {
      return next(new AppError('MY_SHOP vendor not available', 404));
    }

    // Reassign to MY_SHOP vendor (status: PENDING - they need to accept it)
    order.assignedVendorId = myShopVendor._id;
    order.status = 'PENDING';
    order.rejectionReason = reason || 'Not available at warehouse';
    await order.save();

    console.log(
      `Order ${orderId} rejected by warehouse fulfiller and reassigned to MY_SHOP ${myShopVendor._id} as PENDING. Reason: ${reason || 'None provided'}`
    );

    res.status(200).json({
      success: true,
      message: 'Order reassigned to shop vendor successfully',
      data: { order },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Update order status to PICKED_FROM_VENDOR
 */
export const markPickedFromVendor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { orderId } = req.params;
    const fulfiller = req.user;

    if (fulfiller.vendorType !== 'WAREHOUSE_FULFILLER') {
      return next(
        new AppError('Access denied. Only warehouse fulfillers can update order status.', 403)
      );
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.assignedVendorId?.toString() !== fulfiller._id.toString()) {
      return next(new AppError('This order is not assigned to you', 403));
    }

    if (order.status !== 'ACCEPTED') {
      return next(
        new AppError(
          `Cannot mark as picked. Order must be ACCEPTED first. Current status: ${order.status}`,
          400
        )
      );
    }

    order.status = 'PICKED_FROM_VENDOR';
    await order.save();

    console.log(`Order ${orderId} marked as PICKED_FROM_VENDOR by ${fulfiller._id}`);

    res.status(200).json({
      success: true,
      message: 'Order marked as picked from vendor',
      data: { order },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Update order status to PACKED
 */
export const markPacked = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const fulfiller = req.user;

    if (fulfiller.vendorType !== 'WAREHOUSE_FULFILLER') {
      return next(
        new AppError('Access denied. Only warehouse fulfillers can update order status.', 403)
      );
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.assignedVendorId?.toString() !== fulfiller._id.toString()) {
      return next(new AppError('This order is not assigned to you', 403));
    }

    if (order.status !== 'PICKED_FROM_VENDOR') {
      return next(
        new AppError(
          `Cannot mark as packed. Order must be PICKED_FROM_VENDOR first. Current status: ${order.status}`,
          400
        )
      );
    }

    order.status = 'PACKED';
    await order.save();

    console.log(`Order ${orderId} marked as PACKED by ${fulfiller._id}`);

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
 * Update order status to PICKED_UP (delivery picked up from warehouse)
 */
export const markPickedUp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const fulfiller = req.user;

    if (fulfiller.vendorType !== 'WAREHOUSE_FULFILLER') {
      return next(
        new AppError('Access denied. Only warehouse fulfillers can update order status.', 403)
      );
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.assignedVendorId?.toString() !== fulfiller._id.toString()) {
      return next(new AppError('This order is not assigned to you', 403));
    }

    if (order.status !== 'PACKED') {
      return next(
        new AppError(
          `Cannot mark as picked up. Order must be PACKED first. Current status: ${order.status}`,
          400
        )
      );
    }

    order.status = 'PICKED_UP';
    await order.save();

    console.log(`Order ${orderId} marked as PICKED_UP by ${fulfiller._id}`);

    res.status(200).json({
      success: true,
      message: 'Order marked as picked up by delivery',
      data: { order },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Update order status to IN_TRANSIT
 */
export const markInTransit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const fulfiller = req.user;

    if (fulfiller.vendorType !== 'WAREHOUSE_FULFILLER') {
      return next(
        new AppError('Access denied. Only warehouse fulfillers can update order status.', 403)
      );
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.assignedVendorId?.toString() !== fulfiller._id.toString()) {
      return next(new AppError('This order is not assigned to you', 403));
    }

    if (order.status !== 'PICKED_UP') {
      return next(
        new AppError(
          `Cannot mark as in transit. Order must be PICKED_UP first. Current status: ${order.status}`,
          400
        )
      );
    }

    order.status = 'IN_TRANSIT';
    await order.save();

    console.log(`Order ${orderId} marked as IN_TRANSIT by ${fulfiller._id}`);

    // Send order shipped email to customer
    try {
      const populatedOrder = await order.populate('customer_id');
      const customer = populatedOrder.customer_id as any;
      if (customer?.email) {
        await sendOrderShippedEmail(
          customer.email,
          customer.name || 'Customer',
          `#${order._id.toString().slice(-8)}`,
          undefined, // tracking info can be added later
          '1-3 business days'
        );
      }
    } catch (emailError: any) {
      console.error('Failed to send order shipped email:', emailError.message);
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
 * Update order status to DELIVERED
 */
export const markDelivered = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const fulfiller = req.user;

    if (fulfiller.vendorType !== 'WAREHOUSE_FULFILLER') {
      return next(
        new AppError('Access denied. Only warehouse fulfillers can update order status.', 403)
      );
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.assignedVendorId?.toString() !== fulfiller._id.toString()) {
      return next(new AppError('This order is not assigned to you', 403));
    }

    if (!['PICKED_UP', 'IN_TRANSIT'].includes(order.status)) {
      return next(
        new AppError(
          `Cannot mark as delivered. Order must be PICKED_UP or IN_TRANSIT. Current status: ${order.status}`,
          400
        )
      );
    }

    order.status = 'DELIVERED';
    await order.save();

    console.log(`[markDelivered] Order ${orderId} marked as DELIVERED by ${fulfiller._id}`);

    // Send delivery completed email to customer
    console.log('[markDelivered] Starting customer email send process...');
    try {
      const populatedOrder = await order.populate('customer_id');
      const customer = populatedOrder.customer_id as any;
      
      console.log('[markDelivered] Customer populated:', {
        customerId: customer?._id,
        email: customer?.email,
        name: customer?.name
      });
      
      if (customer?.email) {
        console.log('[markDelivered] Sending delivery completed email to:', customer.email);
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
        console.log('[markDelivered] ✅ Delivery completed email sent successfully!');
      } else {
        console.log('[markDelivered] ⚠️ No customer email found, skipping email');
      }
    } catch (emailError: any) {
      console.error('[markDelivered] ❌ Failed to send delivery completed email:', emailError.message);
      console.error('[markDelivered] Email error stack:', emailError.stack);
    }

    // Send admin notification for delivered order
    console.log('[markDelivered] Starting admin notification process...');
    try {
      const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
      console.log('[markDelivered] Admin emails:', adminEmails);
      
      const populatedOrder = await order.populate(['customer_id', 'items.product_id']);
      const customer = populatedOrder.customer_id as any;
      
      console.log('[markDelivered] Sending admin notifications to', adminEmails.length, 'admins');
      
      for (const adminEmail of adminEmails) {
        await sendAdminDeliveryNotificationEmail(
          adminEmail.trim(),
          `#${order._id.toString().slice(-8)}`,
          {
            customerName: customer?.name || 'Customer',
            totalAmount: order.total,
            items: populatedOrder.items,
            deliveredAt: new Date().toLocaleString('en-IN'),
            vendorName: fulfiller.name || 'Warehouse Fulfiller',
          }
        );
      }
      console.log('[markDelivered] ✅ Admin delivery notifications sent successfully');
    } catch (emailError: any) {
      console.error('[markDelivered] ❌ Failed to send admin delivery notification:', emailError.message);
      console.error('[markDelivered] Admin email error stack:', emailError.stack);
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
