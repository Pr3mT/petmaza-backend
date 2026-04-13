import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import Order from '../models/Order';
import User from '../models/User';
import { AppError } from '../middlewares/errorHandler';
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

    const orders = await Order.find({
      assignedVendorId: vendor._id,
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
 * Accept order by MY_SHOP vendor
 */
export const acceptOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const vendor = req.user;

    console.log('[myShop:acceptOrder] Request received:', {
      orderId,
      userId: vendor?._id,
      userRole: vendor?.role,
      vendorType: vendor?.vendorType,
    });

    if (vendor.vendorType !== 'MY_SHOP') {
      console.log('[myShop:acceptOrder] Access denied - not a MY_SHOP vendor');
      return next(new AppError('Access denied. Only MY_SHOP vendors can accept orders.', 403));
    }

    const order = await Order.findById(orderId);

    if (!order) {
      console.log('[myShop:acceptOrder] Order not found:', orderId);
      return next(new AppError('Order not found', 404));
    }

    console.log('[myShop:acceptOrder] Order found:', {
      orderId: order._id,
      status: order.status,
      assignedVendorId: order.assignedVendorId,
    });

    if (order.assignedVendorId?.toString() !== vendor._id.toString()) {
      console.log('[myShop:acceptOrder] Order not assigned to this vendor');
      return next(new AppError('This order is not assigned to you', 403));
    }

    if (order.status !== 'PENDING') {
      console.log('[myShop:acceptOrder] Order not pending:', order.status);
      return next(new AppError(`Order is already ${order.status}`, 400));
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
        console.error(`Failed to record sale for product ${item.product_id}:`, error);
      }
    }

    order.status = 'ACCEPTED';
    await order.save();

    console.log(`[myShop:acceptOrder] Order ${orderId} accepted successfully by ${vendor._id}`);

    // Send email to customer
    console.log('[myShop:acceptOrder] Starting email send process...');
    try {
      const populatedOrder = await order.populate('customer_id');
      const customer = populatedOrder.customer_id as any;
      
      console.log('[myShop:acceptOrder] Customer populated:', {
        customerId: customer?._id,
        email: customer?.email,
        name: customer?.name
      });
      
      if (customer?.email) {
        console.log('[myShop:acceptOrder] Sending order accepted email to:', customer.email);
        await sendOrderAcceptedEmail(
          customer.email,
          customer.name || 'Customer',
          `#${order._id.toString().slice(-8)}`,
          vendor.name || 'Shop Manager',
          '2-5 business days'
        );
        console.log('[myShop:acceptOrder] ✅ Order accepted email sent successfully!');
      } else {
        console.log('[myShop:acceptOrder] ⚠️ No customer email found, skipping email');
      }
    } catch (emailError: any) {
      console.error('[myShop:acceptOrder] ❌ Failed to send order accepted email:', emailError.message);
      console.error('[myShop:acceptOrder] Email error stack:', emailError.stack);
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

    console.log('[myShop:refundOrder] Request received:', {
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
          console.error(`Failed to reverse sale for product ${item.product_id}:`, error);
        }
      }
    }

    // Process refund
    order.status = 'CANCELLED';
    order.refundReason = reason || 'Unable to fulfill order';
    order.refundedAt = new Date();
    
    // If payment was made, mark for refund processing
    if (order.payment_status === 'Paid') {
      order.refundStatus = 'PENDING';
      order.refundAmount = order.total;
    }

    await order.save();

    console.log(`Order ${orderId} refunded by MY_SHOP vendor ${vendor._id}. Reason: ${reason || 'None provided'}`);

    // Send refund initiated email to customer
    try {
      const customer = order.customer_id as any;
      if (customer?.email) {
        await sendRefundInitiatedEmail(
          customer.email,
          customer.name || 'Customer',
          `#${order._id.toString().slice(-8)}`,
          order.total || 0,
          order.refundReason || 'Product not available'
        );
      }
    } catch (emailError: any) {
      console.error('Failed to send refund initiated email:', emailError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Order refund initiated successfully',
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

    console.log(`[myShop:markDelivered] Order ${orderId} marked as DELIVERED by ${vendor._id}`);

    // Send delivery completed email to customer
    console.log('[myShop:markDelivered] Starting customer email send process...');
    try {
      const populatedOrder = await order.populate('customer_id');
      const customer = populatedOrder.customer_id as any;
      
      console.log('[myShop:markDelivered] Customer populated:', {
        customerId: customer?._id,
        email: customer?.email,
        name: customer?.name
      });
      
      if (customer?.email) {
        console.log('[myShop:markDelivered] Sending delivery completed email to:', customer.email);
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
        console.log('[myShop:markDelivered] ✅ Delivery completed email sent successfully!');
      } else {
        console.log('[myShop:markDelivered] ⚠️ No customer email found, skipping email');
      }
    } catch (emailError: any) {
      console.error('[myShop:markDelivered] ❌ Failed to send delivery completed email:', emailError.message);
      console.error('[myShop:markDelivered] Email error stack:', emailError.stack);
    }

    // Send admin notification for delivered order
    console.log('[myShop:markDelivered] Starting admin notification process...');
    try {
      const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
      console.log('[myShop:markDelivered] Admin emails:', adminEmails);
      
      const populatedOrder = await order.populate(['customer_id', 'items.product_id']);
      const customer = populatedOrder.customer_id as any;
      
      console.log('[myShop:markDelivered] Sending admin notifications to', adminEmails.length, 'admins');
      
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
      console.log('[myShop:markDelivered] ✅ Admin delivery notifications sent successfully');
    } catch (emailError: any) {
      console.error('[myShop:markDelivered] ❌ Failed to send admin delivery notification:', emailError.message);
      console.error('[myShop:markDelivered] Admin email error stack:', emailError.stack);
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
