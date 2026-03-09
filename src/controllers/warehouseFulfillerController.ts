import { Response, NextFunction } from 'express';
import Order from '../models/Order';
import User from '../models/User';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import logger from '../config/logger';
import { 
  queueOrderAcceptedEmail, 
  sendOrderRejectedEmail, 
  sendOrderShippedEmail,
  sendDeliveryCompletedEmail,
  sendAdminDeliveryNotificationEmail
} from '../services/emailer';

/**
 * Get orders assigned to warehouse fulfiller
 * Shows orders that contain products from fulfiller's assigned subcategories
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

    // Get fulfiller's assigned subcategories from VendorDetails
    const VendorDetails = (await import('../models/VendorDetails')).default;
    const vendorDetails = await VendorDetails.findOne({ vendor_id: fulfiller._id });

    if (!vendorDetails || !vendorDetails.assignedSubcategories || vendorDetails.assignedSubcategories.length === 0) {
      logger.info(`[getWarehouseFulfillerOrders] Fulfiller ${fulfiller._id} has no assigned subcategories`);
      return res.status(200).json({
        success: true,
        data: { orders: [] },
      });
    }

    const assignedSubcategories = vendorDetails.assignedSubcategories;
    logger.info(`[getWarehouseFulfillerOrders] Fulfiller ${fulfiller.name} assigned subcategories:`, assignedSubcategories);

    // Fetch orders assigned to this fulfiller
    const orders = await Order.find({
      assignedVendorId: fulfiller._id,
      status: {
        $in: [
          'PENDING',
          'ACCEPTED',
          'PACKED',
          'PICKED_UP',
          'IN_TRANSIT',
          'DELIVERED',
        ],
      },
    })
      .populate('customer_id', 'name email phone')
      .populate('items.product_id', 'name images subCategory mainCategory')
      .sort({ createdAt: -1 });

    logger.info(`[getWarehouseFulfillerOrders] Found ${orders.length} orders for ${fulfiller.name}`);

    res.status(200).json({
      success: true,
      data: { orders },
    });
  } catch (error: any) {
    logger.error('[getWarehouseFulfillerOrders] Error:', error);
    next(error);
  }
};

/**
 * Accept order by warehouse fulfiller
 * Verifies that order contains products from fulfiller's assigned subcategories
 */
export const acceptOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const fulfiller = req.user;

    logger.info('[acceptOrder] Request received:', {
      orderId,
      userId: fulfiller?._id,
      userName: fulfiller?.name,
      userRole: fulfiller?.role,
      vendorType: fulfiller?.vendorType,
    });

    if (fulfiller.vendorType !== 'WAREHOUSE_FULFILLER') {
      logger.warn('[acceptOrder] Access denied - not a warehouse fulfiller');
      return next(new AppError('Access denied. Only warehouse fulfillers can accept orders.', 403));
    }

    // Get fulfiller's assigned subcategories
    const VendorDetails = (await import('../models/VendorDetails')).default;
    const vendorDetails = await VendorDetails.findOne({ vendor_id: fulfiller._id });

    if (!vendorDetails || !vendorDetails.assignedSubcategories || vendorDetails.assignedSubcategories.length === 0) {
      logger.warn('[acceptOrder] Fulfiller has no assigned subcategories');
      return next(new AppError('You have no assigned subcategories. Please contact admin.', 403));
    }

    const assignedSubcategories = vendorDetails.assignedSubcategories;
    logger.info(`[acceptOrder] Fulfiller ${fulfiller.name} assigned subcategories:`, assignedSubcategories);

    // Find order and populate products
    const order = await Order.findById(orderId).populate('items.product_id', 'name images subCategory mainCategory');

    if (!order) {
      logger.warn('[acceptOrder] Order not found:', orderId);
      return next(new AppError('Order not found', 404));
    }

    logger.info('[acceptOrder] Order found:', {
      orderId: order._id,
      status: order.status,
      itemsCount: order.items.length,
    });

    // Verify that order contains products from assigned subcategories
    const hasMatchingProducts = order.items.some(item => {
      const product = item.product_id as any;
      if (product && product.subCategory) {
        return assignedSubcategories.includes(product.subCategory);
      }
      return false;
    });

    if (!hasMatchingProducts) {
      logger.warn('[acceptOrder] Order does not contain products from fulfiller\'s assigned subcategories');
      return next(new AppError('This order does not contain products from your assigned categories', 403));
    }

    if (order.status !== 'PENDING') {
      logger.warn('[acceptOrder] Order not pending:', order.status);
      return next(new AppError(`Order is already ${order.status}`, 400));
    }

    // Assign the order to this fulfiller and mark as accepted
    order.status = 'ACCEPTED';
    order.assignedVendorId = fulfiller._id as any;
    await order.save();

    logger.info(`[acceptOrder] ✅ Order ${orderId} accepted successfully by ${fulfiller.name} (${fulfiller._id})`);

    // Queue email to customer (non-blocking)
    try {
      const populatedOrder = await order.populate('customer_id');
      const customer = populatedOrder.customer_id as any;
      
      if (customer?.email) {
        logger.info('[acceptOrder] Queueing order accepted email to:', customer.email);
        const jobId = queueOrderAcceptedEmail(
          customer.email,
          customer.name || 'Customer',
          `#${order._id.toString().slice(-8)}`,
          fulfiller.name || 'Warehouse',
          '2-5 business days'
        );
        logger.info(`[acceptOrder] ✅ Order accepted email queued (Job: ${jobId})`);
      } else {
        logger.info('[acceptOrder] ⚠️ Customer email not found, skipping email');
      }
    } catch (emailError: any) {
      logger.error('[acceptOrder] ❌ Failed to queue order accepted email:', emailError.message);
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
 * Update order status to PACKED
 */
export const markPacked = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const fulfiller = req.user;

    console.log('[markPacked] Request received:', { orderId, fulfillerId: fulfiller._id, vendorType: fulfiller.vendorType });

    if (fulfiller.vendorType !== 'WAREHOUSE_FULFILLER') {
      console.log('[markPacked] Access denied - not a warehouse fulfiller');
      return next(
        new AppError('Access denied. Only warehouse fulfillers can update order status.', 403)
      );
    }

    const order = await Order.findById(orderId);

    if (!order) {
      console.log('[markPacked] Order not found:', orderId);
      return next(new AppError('Order not found', 404));
    }

    console.log('[markPacked] Order found:', {
      orderId: order._id,
      currentStatus: order.status,
      assignedVendorId: order.assignedVendorId,
      requesterVendorId: fulfiller._id
    });

    if (order.assignedVendorId?.toString() !== fulfiller._id.toString()) {
      console.log('[markPacked] Order not assigned to this fulfiller');
      return next(new AppError('This order is not assigned to you', 403));
    }

    if (order.status !== 'ACCEPTED') {
      console.log(`[markPacked] Invalid status. Expected: ACCEPTED, Got: ${order.status}`);
      return next(
        new AppError(
          `Cannot mark as packed. Order must be ACCEPTED first. Current status: ${order.status}`,
          400
        )
      );
    }

    order.status = 'PACKED';
    await order.save();

    console.log(`[markPacked] ✅ Order ${orderId} marked as PACKED by ${fulfiller._id}`);

    res.status(200).json({
      success: true,
      message: 'Order marked as packed',
      data: { order },
    });
  } catch (error: any) {
    console.error('[markPacked] Error:', error);
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
