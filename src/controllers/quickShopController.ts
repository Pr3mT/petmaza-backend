import logger from '../config/logger';
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import Order from '../models/Order';
import Product from '../models/Product';
import VendorDetails from '../models/VendorDetails';
import QuickProductListing from '../models/QuickProductListing';
import { OrderRoutingService } from '../services/OrderRoutingService';
import { orderQueue } from '../services/OrderQueue';
import { sanitizeOrderForVendor } from '../utils/vendorOrderSanitizer';
import {
  sendOrderAcceptedEmail,
  sendDeliveryCompletedEmail,
  sendRefundInitiatedEmail,
} from '../services/emailer';

// ==================== CUSTOMER-FACING ====================

// Whether Petmaza Quick covers a given pincode, and which shop would serve it.
export const getAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pincode = String(req.query.pincode || '').trim();
    if (!pincode) {
      return next(new AppError('Pincode is required', 400));
    }

    const vendorDetails = await VendorDetails.findOne({
      vendorType: 'QUICK_SHOP',
      serviceablePincodes: pincode,
      isApproved: true,
    }).lean();

    if (!vendorDetails) {
      return res.status(200).json({ success: true, data: { available: false } });
    }

    res.status(200).json({
      success: true,
      data: { available: true, shopName: vendorDetails.shopName, vendorId: vendorDetails.vendor_id },
    });
  } catch (error: any) {
    next(error);
  }
};

// Catalog products available for Quick delivery to a given pincode, with the
// matched shop's own price/stock.
export const getQuickProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pincode = String(req.query.pincode || '').trim();
    if (!pincode) {
      return next(new AppError('Pincode is required', 400));
    }

    const vendorDetails = await VendorDetails.findOne({
      vendorType: 'QUICK_SHOP',
      serviceablePincodes: pincode,
      isApproved: true,
    }).lean();

    if (!vendorDetails) {
      return res.status(200).json({ success: true, data: { available: false, products: [] } });
    }

    const listings = await QuickProductListing.find({ vendor_id: vendorDetails.vendor_id, isActive: true, stock: { $gt: 0 } })
      .populate({
        path: 'product_id',
        match: { isActive: true },
        populate: [{ path: 'brand_id', select: 'name' }, { path: 'category_id', select: 'name' }],
      })
      .lean();

    const products = listings
      .filter((l: any) => l.product_id)
      .map((l: any) => ({
        ...l.product_id,
        // Override shared catalog pricing/stock with this shop's own Quick listing.
        sellingPrice: l.sellingPrice,
        mrp: l.product_id.mrp ?? l.sellingPrice,
        stock: l.stock,
        inStock: l.stock > 0,
        quickListingId: l._id,
      }));

    res.status(200).json({
      success: true,
      data: { available: true, shopName: vendorDetails.shopName, products },
    });
  } catch (error: any) {
    next(error);
  }
};

// Place a Petmaza Quick order — single-shop cart, routed by pincode.
export const createQuickOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { items, customerPincode, customerAddress, deliveryMode } = req.body;

    if (!items || items.length === 0) {
      return next(new AppError('Order must have at least one item', 400));
    }
    if (!customerPincode || !customerAddress) {
      return next(new AppError('Pincode and address are required', 400));
    }
    if (!['HALF_HOUR', 'ONE_DAY'].includes(deliveryMode)) {
      return next(new AppError('deliveryMode must be HALF_HOUR or ONE_DAY', 400));
    }

    let contactPhone = String(customerAddress.phone || req.user.phone || '').replace(/\D/g, '');
    if (contactPhone.length > 10) contactPhone = contactPhone.slice(-10);
    if (contactPhone.length !== 10) {
      return next(new AppError('A valid 10-digit contact number is required to place an order', 400));
    }
    customerAddress.phone = contactPhone;

    const { order } = await OrderRoutingService.routeQuickOrder({
      customer_id: req.user._id.toString(),
      items,
      customerPincode,
      customerAddress,
      deliveryMode,
    });

    order.grandTotal = order.total;
    order.subtotalBeforeCharges = order.total;
    await order.save();

    logger.info(`[createQuickOrder] Quick order ${order._id} created (${deliveryMode})`);

    res.status(201).json({
      success: true,
      message: 'Quick order created successfully',
      data: { orders: [order], isSplitShipment: false, totalAmount: order.total },
    });

    orderQueue.emit('order:created', {
      userEmail: req.user.email,
      userName: req.user.name,
      userId: req.user._id.toString(),
      orderIds: [order._id.toString()],
      isSplitShipment: false,
      combinedSubtotal: order.total,
      shippingCharges: 0,
      platformFee: 0,
      discountAmount: 0,
      customerAddress: order.customerAddress,
      adminEmails: process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim()).filter(Boolean) : [],
      totalAmount: order.total,
    });
  } catch (error: any) {
    next(error);
  }
};

// ==================== SHOP ADMIN — CATALOG & LISTINGS ====================

// Browse the full existing product catalog to pick products from for Quick.
export const getCatalog = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search = '', page = 1, limit = 30 } = req.query as any;
    const query: any = { isActive: true };
    if (search) query.name = { $regex: String(search), $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      Product.find(query).select('name images mrp sellingPrice brand_id mainCategory subCategory').populate('brand_id', 'name').sort({ name: 1 }).skip(skip).limit(Number(limit)),
      Product.countDocuments(query),
    ]);

    res.status(200).json({ success: true, data: { products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (error: any) {
    next(error);
  }
};

export const getMyListings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const listings = await QuickProductListing.find({ vendor_id: req.user._id })
      .populate('product_id', 'name images mrp brand_id')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { listings } });
  } catch (error: any) {
    next(error);
  }
};

export const upsertListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { product_id, sellingPrice, stock, isActive } = req.body;
    if (!product_id || sellingPrice === undefined) {
      return next(new AppError('product_id and sellingPrice are required', 400));
    }
    if (Number(sellingPrice) < 0 || (stock !== undefined && Number(stock) < 0)) {
      return next(new AppError('sellingPrice and stock must be non-negative', 400));
    }

    const product = await Product.findById(product_id).select('_id');
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    const listing = await QuickProductListing.findOneAndUpdate(
      { vendor_id: req.user._id, product_id },
      {
        $set: {
          sellingPrice: Number(sellingPrice),
          ...(stock !== undefined ? { stock: Number(stock) } : {}),
          ...(isActive !== undefined ? { isActive: !!isActive } : {}),
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).populate('product_id', 'name images mrp brand_id');

    res.status(200).json({ success: true, data: { listing } });
  } catch (error: any) {
    next(error);
  }
};

export const deleteListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { product_id } = req.params;
    await QuickProductListing.findOneAndDelete({ vendor_id: req.user._id, product_id });
    res.status(200).json({ success: true, message: 'Removed from Petmaza Quick' });
  } catch (error: any) {
    next(error);
  }
};

// ==================== SHOP ADMIN — ORDERS ====================
// Mirrors myShopVendorController's accept/reject/pack/pickup/deliver flow,
// scoped to this vendor's QUICK-channel orders.

export const getQuickShopOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vendor = req.user;
    const orders = await Order.find({
      payment_status: 'Paid',
      assignedVendorId: vendor._id,
      orderChannel: 'QUICK',
    })
      .populate('customer_id', 'name email phone')
      .populate('items.product_id', 'name images')
      .sort({ createdAt: -1 });

    const sanitized = orders.map((o) => {
      const plain = o.toObject();
      const sanitizedOrder = sanitizeOrderForVendor(plain);
      sanitizedOrder.customerPaidTotal = plain.grandTotal || plain.total || 0;
      return sanitizedOrder;
    });

    res.status(200).json({ success: true, data: { orders: sanitized } });
  } catch (error: any) {
    next(error);
  }
};

async function findOwnQuickOrder(vendor: any, orderId: string) {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (order.orderChannel !== 'QUICK') throw new AppError('Not a Petmaza Quick order', 400);
  if (order.assignedVendorId?.toString() !== vendor._id.toString()) {
    throw new AppError('This order is not assigned to you', 403);
  }
  return order;
}

export const acceptOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const order = await findOwnQuickOrder(req.user, orderId);

    if (order.status !== 'PENDING') {
      return next(new AppError(`Order is already ${order.status}`, 400));
    }
    if (order.payment_status !== 'Paid') {
      return next(new AppError('Order cannot be accepted before successful payment', 400));
    }

    // Deduct stock from the shop's own Quick listings now that they've committed to fulfil it.
    for (const item of order.items) {
      await QuickProductListing.updateOne(
        { vendor_id: req.user._id, product_id: item.product_id },
        { $inc: { stock: -item.quantity } }
      );
    }

    order.status = 'ACCEPTED';
    await order.save();

    try {
      const populatedOrder = await order.populate('customer_id');
      const customer = populatedOrder.customer_id as any;
      if (customer?.email) {
        await sendOrderAcceptedEmail(
          customer.email,
          customer.name || 'Customer',
          `#${order._id.toString().slice(-8)}`,
          req.user.name || 'Shop Admin',
          order.quickDeliveryMode === 'HALF_HOUR' ? '30 minutes' : '1 day'
        );
      }
    } catch (emailError: any) {
      logger.error('[quickShop:acceptOrder] Failed to send email:', emailError.message);
    }

    res.status(200).json({ success: true, message: 'Order accepted successfully', data: { order } });
  } catch (error: any) {
    next(error);
  }
};

// Shop admin can't fulfil this order — refund it (same as MY_SHOP's flow for prepaid orders).
export const rejectOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const order = await findOwnQuickOrder(req.user, orderId).then((o) => o.populate('customer_id', 'name email phone'));

    if (!['PENDING', 'ACCEPTED'].includes(order.status)) {
      return next(new AppError(`Cannot reject order that is already ${order.status}`, 400));
    }

    if (order.status === 'ACCEPTED') {
      for (const item of order.items) {
        await QuickProductListing.updateOne(
          { vendor_id: req.user._id, product_id: item.product_id },
          { $inc: { stock: item.quantity } }
        );
      }
    }

    order.status = 'REFUND_INITIATED';
    order.refundReason = reason || 'Unable to fulfil order';
    order.refundedAt = new Date();
    if (order.payment_status === 'Paid') {
      order.refundStatus = 'PENDING';
      order.refundAmount = order.grandTotal || order.total || 0;
    }
    await order.save();

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
      }
    } catch (emailError: any) {
      logger.error('[quickShop:rejectOrder] Failed to send email:', emailError.message);
    }

    res.status(200).json({ success: true, message: 'Order rejected and refund initiated', data: { order } });
  } catch (error: any) {
    next(error);
  }
};

export const markPacked = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await findOwnQuickOrder(req.user, req.params.orderId);
    if (order.status !== 'ACCEPTED') {
      return next(new AppError(`Cannot pack order that is ${order.status}`, 400));
    }
    order.status = 'PACKED';
    await order.save();
    res.status(200).json({ success: true, message: 'Order marked as packed', data: { order } });
  } catch (error: any) {
    next(error);
  }
};

export const markPickedUp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await findOwnQuickOrder(req.user, req.params.orderId);
    if (order.status !== 'PACKED') {
      return next(new AppError(`Cannot mark as picked up from status ${order.status}`, 400));
    }
    order.status = 'PICKED_UP';
    await order.save();
    res.status(200).json({ success: true, message: 'Order picked up for delivery', data: { order } });
  } catch (error: any) {
    next(error);
  }
};

// Quick deliveries are local/fast — courier tracking is optional, unlike the
// courier-mandatory flow used for standard shipped orders.
export const markInTransit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await findOwnQuickOrder(req.user, req.params.orderId);
    if (order.status !== 'PICKED_UP') {
      return next(new AppError(`Cannot mark as in transit from status ${order.status}`, 400));
    }
    const { courier_name, tracking_id } = req.body || {};
    if (courier_name || tracking_id) {
      if (!order.courier) order.courier = {};
      if (courier_name) order.courier.name = String(courier_name).trim();
      if (tracking_id) order.courier.tracking_id = String(tracking_id).trim();
    }
    order.status = 'IN_TRANSIT';
    await order.save();
    res.status(200).json({ success: true, message: 'Order out for delivery', data: { order } });
  } catch (error: any) {
    next(error);
  }
};

export const markDelivered = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await findOwnQuickOrder(req.user, req.params.orderId);
    if (order.status !== 'IN_TRANSIT') {
      return next(new AppError(`Cannot mark as delivered from status ${order.status}`, 400));
    }
    order.status = 'DELIVERED';
    order.deliveredAt = new Date();
    await order.save();

    try {
      const populatedOrder = await order.populate('customer_id');
      const customer = populatedOrder.customer_id as any;
      if (customer?.email) {
        await sendDeliveryCompletedEmail(
          customer.email,
          customer.name || 'Customer',
          `#${order._id.toString().slice(-8)}`,
          new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        );
      }
    } catch (emailError: any) {
      logger.error('[quickShop:markDelivered] Failed to send email:', emailError.message);
    }

    res.status(200).json({ success: true, message: 'Order marked as delivered', data: { order } });
  } catch (error: any) {
    next(error);
  }
};
