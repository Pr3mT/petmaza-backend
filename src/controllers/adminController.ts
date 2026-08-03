import logger from '../config/logger';
import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import Product from '../models/Product';
import Order from '../models/Order';
import Coupon from '../models/Coupon';
import Transaction from '../models/Transaction';
import ShippingSettings from '../models/ShippingSettings';
import ShippingDetails from '../models/ShippingDetails';
import Settlement from '../models/Settlement';
import VendorPayout from '../models/VendorPayout';
import CategoryFulfillerMapping from '../models/CategoryFulfillerMapping';
// Registers the PrimeProduct schema so `.populate('items.primeProduct_id')` in
// getVendorBilling works. The model file self-registers on import; without this
// the populate throws MissingSchemaError and the endpoint 500s.
import '../models/PrimeProduct';
import {
  PAYABLE_STATUSES,
  computeOrderPayouts,
  computeVendorPayoutForOrder,
  payableDateOf,
  ShippingDetailsLike,
} from '../services/VendorPayoutService';
import { VendorProductPricingService } from '../services/VendorProductPricingService';
import { ShippingService } from '../services/ShippingService';
import { parseStoreLocationUpdate } from '../services/QuickServiceabilityService';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

export const getUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { role, vendorType, page = 1, limit = 20 } = req.query;

    const query: any = {};
    if (role) {
      query.role = role;
    }
    if (vendorType) {
      query.vendorType = vendorType;
    }

    const skip = (Number(page) - 1) * Number(limit);

    let users: any[] = await User.find(query)
      .select('-password')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    // Shop Admin lists also show each shop's name and delivery pincodes, so
    // attach them from VendorDetails in one batch query.
    if (vendorType === 'QUICK_SHOP' && users.length) {
      const VendorDetails = (await import('../models/VendorDetails')).default;
      const details = await VendorDetails.find({ vendor_id: { $in: users.map((u) => u._id) } })
        .select('vendor_id shopName serviceablePincodes storeLocation deliveryRadiusKm')
        .lean();
      const byVendor = new Map(details.map((d: any) => [d.vendor_id.toString(), d]));
      users = users.map((u) => {
        const d = byVendor.get(u._id.toString());
        return {
          ...u.toObject(),
          shopName: d?.shopName || '',
          serviceablePincodes: d?.serviceablePincodes || [],
          // Dark-store serviceability — the list shows "4 km radius" for located
          // shops and falls back to the pincode chips for ones without a pin yet.
          storeLocation: d?.storeLocation || null,
          deliveryRadiusKm: d?.deliveryRadiusKm ?? null,
        };
      });
    }

    res.status(200).json({
      success: true,
      data: {
        users,
        vendors: users, // Also return as 'vendors' for compatibility
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getUserById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    logger.info('🔍 getUserById called with id:', id);

    const user = await User.findById(id).select('-password');
    logger.info('📦 User found:', user ? 'Yes' : 'No');

    if (!user) {
      logger.info('❌ User not found for id:', id);
      return next(new AppError('User not found', 404));
    }

    logger.info('✅ Returning user:', user._id);
    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error: any) {
    logger.error('❌ Error in getUserById:', error.message);
    next(error);
  }
};

export const approveVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    const VendorDetails = (await import('../models/VendorDetails')).default;

    // If approving a PRIME vendor, auto-assign a sequential primeVendorCode
    let primeCodeUpdate: Record<string, any> = {};
    if (isApproved) {
      const targetUser = await User.findById(id).select('vendorType primeVendorCode').lean();
      if (targetUser?.vendorType === 'PRIME' && !targetUser.primeVendorCode) {
        // Find highest existing code and increment
        const highest = await User.findOne({ primeVendorCode: { $exists: true } })
          .sort({ primeVendorCode: -1 })
          .select('primeVendorCode')
          .lean();
        primeCodeUpdate = { primeVendorCode: (highest?.primeVendorCode || 0) + 1 };
      }
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      id,
      { isApproved, ...primeCodeUpdate },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Update vendor details
    const vendorDetails = await VendorDetails.findOneAndUpdate(
      { vendor_id: id },
      {
        isApproved,
        approvedBy: isApproved ? req.user._id : undefined,
        approvedAt: isApproved ? new Date() : undefined,
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: `Vendor ${isApproved ? 'approved' : 'rejected'} successfully`,
      data: {
        user,
        vendorDetails,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getAdminStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // ── Date ranges ──────────────────────────────────────────────────────────
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - daysToMonday);
    thisWeekStart.setHours(0, 0, 0, 0);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);

    // Helper: week-over-week % change
    const pct = (curr: number, prev: number): number =>
      prev > 0 ? +((( curr - prev) / prev) * 100).toFixed(1) : (curr > 0 ? 100 : 0);

    // ── User counts ──────────────────────────────────────────────────────────
    const [vendorCount, customerCount, newCustomersThisWeek, newCustomersLastWeek] = await Promise.all([
      User.countDocuments({ role: 'vendor' }),
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'customer', createdAt: { $gte: thisWeekStart } }),
      User.countDocuments({ role: 'customer', createdAt: { $gte: lastWeekStart, $lt: lastWeekEnd } }),
    ]);

    // ── Product counts ───────────────────────────────────────────────────────
    const [productCount, newProductsThisWeek, newProductsLastWeek] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ createdAt: { $gte: thisWeekStart } }),
      Product.countDocuments({ createdAt: { $gte: lastWeekStart, $lt: lastWeekEnd } }),
    ]);
    const categoryCount = await Product.distinct('category_id').then(ids => ids.length);

    // ── Order statistics ─────────────────────────────────────────────────────
    const [
      totalOrders, paidOrders, pendingOrders,
      deliveredOrders, processingOrders, shippedOrders, cancelledOrders,
      returnRequests, returnRequestsLastWeek,
      thisWeekOrderCount, lastWeekOrderCount,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ payment_status: 'Paid' }),
      Order.countDocuments({ payment_status: 'Pending' }),
      Order.countDocuments({ status: 'DELIVERED' }),
      Order.countDocuments({ status: { $in: ['ACCEPTED', 'PACKED', 'READY_TO_SHIP', 'ASSIGNED'] } }),
      Order.countDocuments({ status: { $in: ['PICKED_UP', 'IN_TRANSIT'] } }),
      Order.countDocuments({ status: 'CANCELLED' }),
      Order.countDocuments({ status: { $in: ['REFUND_INITIATED', 'REFUNDED'] } }),
      Order.countDocuments({ status: { $in: ['REFUND_INITIATED', 'REFUNDED'] }, createdAt: { $gte: lastWeekStart, $lt: lastWeekEnd } }),
      Order.countDocuments({ createdAt: { $gte: thisWeekStart } }),
      Order.countDocuments({ createdAt: { $gte: lastWeekStart, $lt: lastWeekEnd } }),
    ]);

    // ── Revenue from paid orders ─────────────────────────────────────────────
    const paidOrdersData = await Order.find({ payment_status: 'Paid' })
      .select('total totalProfit totalPurchasePrice isPrime createdAt');

    const totalRevenue   = paidOrdersData.reduce((s, o) => s + (o.total || 0), 0);
    const totalProfit    = paidOrdersData.reduce((s, o) => s + (o.totalProfit || 0), 0);
    const totalCost      = paidOrdersData.reduce((s, o) => s + (o.totalPurchasePrice || 0), 0);
    const normalOrdersRevenue = paidOrdersData.filter(o => !o.isPrime).reduce((s, o) => s + (o.total || 0), 0);
    const primeOrdersRevenue  = paidOrdersData.filter(o =>  o.isPrime).reduce((s, o) => s + (o.total || 0), 0);
    const normalOrdersProfit  = paidOrdersData.filter(o => !o.isPrime).reduce((s, o) => s + (o.totalProfit || 0), 0);
    const primeOrdersProfit   = paidOrdersData.filter(o =>  o.isPrime).reduce((s, o) => s + (o.totalProfit || 0), 0);

    // This week / last week split
    const thisWeekPaid = paidOrdersData.filter(o => new Date(o.createdAt) >= thisWeekStart);
    const lastWeekPaid = paidOrdersData.filter(o => {
      const d = new Date(o.createdAt);
      return d >= lastWeekStart && d < lastWeekEnd;
    });
    const thisWeekRevenue = thisWeekPaid.reduce((s, o) => s + (o.total || 0), 0);
    const lastWeekRevenue = lastWeekPaid.reduce((s, o) => s + (o.total || 0), 0);
    const thisWeekProfit  = thisWeekPaid.reduce((s, o) => s + (o.totalProfit || 0), 0);
    const lastWeekProfit  = lastWeekPaid.reduce((s, o) => s + (o.totalProfit || 0), 0);

    // ── Daily sales chart data (Mon–Sun) ─────────────────────────────────────
    const thisWeekDailySales = [0, 0, 0, 0, 0, 0, 0];
    const lastWeekDailySales = [0, 0, 0, 0, 0, 0, 0];
    const toMonIdx = (d: Date) => { const day = d.getDay(); return day === 0 ? 6 : day - 1; };
    thisWeekPaid.forEach(o => { thisWeekDailySales[toMonIdx(new Date(o.createdAt))] += o.total || 0; });
    lastWeekPaid.forEach(o => { lastWeekDailySales[toMonIdx(new Date(o.createdAt))] += o.total || 0; });

    // ── Recent orders ────────────────────────────────────────────────────────
    const recentOrders = await Order.find()
      .populate('customer_id', 'name email phone')
      .populate('items.product_id', 'name images')
      .sort({ createdAt: -1 })
      .limit(5);

    // ── Top selling products ─────────────────────────────────────────────────
    const topSellingProducts = await Product.find({ totalSoldWebsite: { $gt: 0 } })
      .sort({ totalSoldWebsite: -1 })
      .limit(5)
      .select('name images totalSoldWebsite sellingPrice mrp');

    // ── Low stock products ───────────────────────────────────────────────────
    const lowStockProducts = await Product.find({ stock: { $gt: 0, $lte: 15 } })
      .sort({ stock: 1 })
      .limit(5)
      .select('name images stock');

    // ── Top categories by revenue ─────────────────────────────────────────────
    const topCategories = await Order.aggregate([
      { $match: { payment_status: 'Paid' } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          // mainCategory is a plain string field — use it directly, not $arrayElemAt
          _id: {
            $ifNull: [
              { $cond: [{ $isArray: '$product.mainCategory' }, { $arrayElemAt: ['$product.mainCategory', 0] }, '$product.mainCategory'] },
              'Other'
            ]
          },
          revenue: { $sum: { $multiply: ['$items.sellingPrice', { $ifNull: ['$items.quantity', 1] }] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    // ── Stock value ──────────────────────────────────────────────────────────
    const stockValueAgg = await Product.aggregate([
      { $match: { stock: { $gt: 0 } } },
      { $project: { value: { $multiply: ['$stock', { $ifNull: ['$sellingPrice', { $ifNull: ['$mrp', 0] }] }] } } },
      { $group: { _id: null, total: { $sum: '$value' } } },
    ]);
    const stockValue = stockValueAgg[0]?.total || 0;

    // ── Active coupons ───────────────────────────────────────────────────────
    const activeCoupons = await Coupon.countDocuments({ isActive: true });

    // ── Avg order value week-over-week ────────────────────────────────────────
    const thisWeekAvg = thisWeekOrderCount > 0 ? thisWeekRevenue / thisWeekOrderCount : 0;
    const lastWeekAvg = lastWeekOrderCount > 0 ? lastWeekRevenue / lastWeekOrderCount : 0;

    res.status(200).json({
      success: true,
      data: {
        users:    { vendors: vendorCount, customers: customerCount },
        products: { total: productCount, categories: categoryCount },
        orders: {
          total: totalOrders, paid: paidOrders, pending: pendingOrders,
          delivered: deliveredOrders, processing: processingOrders,
          shipped: shippedOrders, cancelled: cancelledOrders,
        },
        revenue: {
          total: totalRevenue, totalProfit, totalCost,
          normalOrders: normalOrdersRevenue, primeOrders: primeOrdersRevenue,
          normalOrdersProfit, primeOrdersProfit,
          profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
          averageOrderValue: paidOrders > 0 ? totalRevenue / paidOrders : 0,
        },
        changes: {
          revenue:       pct(thisWeekRevenue, lastWeekRevenue),
          orders:        pct(thisWeekOrderCount, lastWeekOrderCount),
          customers:     pct(newCustomersThisWeek, newCustomersLastWeek),
          profit:        pct(thisWeekProfit, lastWeekProfit),
          avgOrderValue: pct(thisWeekAvg, lastWeekAvg),
        },
        salesChart: {
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          thisWeek: thisWeekDailySales,
          lastWeek: lastWeekDailySales,
        },
        recentOrders,
        topSellingProducts,
        lowStockProducts,
        topCategories,
        newCustomers:   { count: newCustomersThisWeek,  change: pct(newCustomersThisWeek, newCustomersLastWeek) },
        newProducts:    { count: newProductsThisWeek,   change: pct(newProductsThisWeek, newProductsLastWeek) },
        returnRequests: { count: returnRequests,         change: pct(returnRequests, returnRequestsLastWeek) },
        activeCoupons:  { count: activeCoupons },
        stockValue,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getAllOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, orderType, paymentStatus, page = 1, limit = 20 } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (orderType === 'PRIME') query.isPrime = true;
    else if (orderType === 'QUICK') query.orderChannel = 'QUICK';
    else if (orderType === 'NORMAL') { query.isPrime = { $ne: true }; query.orderChannel = { $ne: 'QUICK' }; }
    if (paymentStatus) query.payment_status = paymentStatus;

    // ── Role-based visibility ────────────────────────────────────────────────
    // Full admins see EVERY order (needed to audit abandoned unpaid ones that sit
    // in the pre-cancel grace window). Sub-admins see Paid, Refunded AND Pending
    // (awaiting payment) orders so pending work is visible to them too — only the
    // Failed/abandoned clutter stays hidden. Enforced server-side so no client
    // filter can bypass it.
    if (req.user.role !== 'admin') {
      const subAdminVisible = ['Paid', 'Refunded', 'Pending'];
      if (paymentStatus) {
        // Honour an allowed filter (e.g. just Pending); a disallowed filter (Failed)
        // truthfully returns nothing rather than silently ignoring it.
        query.payment_status = subAdminVisible.includes(String(paymentStatus)) ? paymentStatus : { $in: [] };
      } else {
        query.payment_status = { $in: subAdminVisible };
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await Order.find(query)
      .populate('customer_id', 'name email phone')
      .populate('assignedVendorId', 'name email')
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
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error: any) {
    next(error);
  }
};

// Assign brands to vendor (automatically assigns all products under those brands)
export const assignBrandsToVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { brand_ids, purchasePercentage, availableStock } = req.body;

    if (!brand_ids || !Array.isArray(brand_ids) || brand_ids.length === 0) {
      return next(new AppError('Please provide at least one brand', 400));
    }

    if (!purchasePercentage || purchasePercentage < 0 || purchasePercentage > 100) {
      return next(new AppError('Purchase percentage must be between 0 and 100', 400));
    }

    const result = await VendorProductPricingService.assignBrandsToVendor({
      vendor_id: id,
      brand_ids,
      purchasePercentage: Number(purchasePercentage),
      availableStock: availableStock ? Number(availableStock) : undefined,
    });

    res.status(200).json({
      success: true,
      message: `Successfully assigned ${result.assignedCount} products from ${result.brands.length} brand(s)`,
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Assign specific products to vendor
export const assignProductsToVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { product_ids, purchasePercentage, availableStock } = req.body;

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return next(new AppError('Please provide at least one product', 400));
    }

    if (!purchasePercentage || purchasePercentage < 0 || purchasePercentage > 100) {
      return next(new AppError('Purchase percentage must be between 0 and 100', 400));
    }

    const result = await VendorProductPricingService.assignProductsToVendor({
      vendor_id: id,
      product_ids,
      purchasePercentage: Number(purchasePercentage),
      availableStock: availableStock ? Number(availableStock) : undefined,
    });

    res.status(200).json({
      success: true,
      message: `Successfully assigned ${result.assignedCount} product(s)`,
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

// Get vendor assignments (brands and products)
export const getVendorAssignments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const assignments = await VendorProductPricingService.getVendorAssignments(id);

    res.status(200).json({
      success: true,
      data: assignments,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update vendor product pricing (purchase percentage)
export const updateVendorProductPricing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, productId } = req.params;
    const { purchasePercentage, availableStock, isActive } = req.body;

    if (purchasePercentage !== undefined && (purchasePercentage < 0 || purchasePercentage > 100)) {
      return next(new AppError('Purchase percentage must be between 0 and 100', 400));
    }

    const updated = await VendorProductPricingService.updateVendorProductPricing(id, productId, {
      purchasePercentage: purchasePercentage !== undefined ? Number(purchasePercentage) : undefined,
      availableStock: availableStock !== undefined ? Number(availableStock) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
    });

    res.status(200).json({
      success: true,
      message: 'Vendor product pricing updated successfully',
      data: { pricing: updated },
    });
  } catch (error: any) {
    next(error);
  }
};

// Remove product assignment from vendor
export const removeVendorProductAssignment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, productId } = req.params;

    const removed = await VendorProductPricingService.removeProductFromVendor(id, productId);

    res.status(200).json({
      success: true,
      message: 'Product assignment removed successfully',
      data: { pricing: removed },
    });
  } catch (error: any) {
    next(error);
  }
};

export const cleanupVariantProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Delete all products with parentProduct (separate variant products)
    const deleteResult = await Product.deleteMany({ 
      parentProduct: { $exists: true, $ne: null } 
    });

    // 2. Find duplicate Purepet products
    const purepetProducts = await Product.find({ 
      name: 'Purepet Adult Dog Food',
      hasVariants: true 
    }).sort({ createdAt: 1 }); // Oldest first

    let deletedDuplicates = 0;
    if (purepetProducts.length > 1) {
      // Keep the first one (oldest), delete others
      const toDelete = purepetProducts.slice(1).map(p => p._id);
      await Product.deleteMany({ _id: { $in: toDelete } });
      deletedDuplicates = toDelete.length;
    }

    // 3. Reactivate the original Purepet product
    const updateResult = await Product.updateMany(
      { 
        name: 'Purepet Adult Dog Food',
        hasVariants: true 
      },
      { $set: { isActive: true } }
    );

    // 4. Get the cleaned product for verification
    const cleanedProduct = await Product.findOne({ 
      name: 'Purepet Adult Dog Food',
      hasVariants: true 
    }).select('name hasVariants variants isActive');

    res.json({
      success: true,
      message: 'Variant products cleaned up successfully',
      data: {
        deletedSeparateProducts: deleteResult.deletedCount,
        deletedDuplicates,
        reactivated: updateResult.modifiedCount,
        finalProduct: {
          _id: cleanedProduct?._id,
          name: cleanedProduct?.name,
          isActive: cleanedProduct?.isActive,
          variantsCount: cleanedProduct?.variants?.length,
          variants: cleanedProduct?.variants?.map(v => v.displayWeight)
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
};
export const reseedVariantProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const Category = (await import('../models/Category')).default;
    const Brand = (await import('../models/Brand')).default;

    const dogCategory = await Category.findOne({ name: 'Dog Food' });
    const purepetBrand = await Brand.findOne({ name: 'Purepet' });

    if (!dogCategory || !purepetBrand) {
      return res.status(404).json({
        success: false,
        message: 'Category or Brand not found'
      });
    }

    // Delete all Purepet products
    await Product.deleteMany({ 
      $or: [
        { name: 'Purepet Adult Dog Food' },
        { name: /Purepet Adult Dog Food - / }
      ]
    });

    // Create new product with variants
    const purepetProduct = await Product.create({
      name: 'Purepet Adult Dog Food',
      description: 'Premium quality adult dog food with chicken and vegetables. Complete nutrition for your pet.',
      category_id: dogCategory._id,
      brand_id: purepetBrand._id,
      hasVariants: true,
      variants: [
        { weight: 200, unit: 'g', displayWeight: '200g', mrp: 60, sellingPercentage: 80, sellingPrice: 48, discount: 20, purchasePercentage: 60, purchasePrice: 36, isActive: true },
        { weight: 500, unit: 'g', displayWeight: '500g', mrp: 150, sellingPercentage: 80, sellingPrice: 120, discount: 20, purchasePercentage: 60, purchasePrice: 90, isActive: true },
        { weight: 1, unit: 'kg', displayWeight: '1kg', mrp: 200, sellingPercentage: 80, sellingPrice: 160, discount: 20, purchasePercentage: 60, purchasePrice: 120, isActive: true },
        { weight: 5, unit: 'kg', displayWeight: '5kg', mrp: 500, sellingPercentage: 80, sellingPrice: 400, discount: 20, purchasePercentage: 60, purchasePrice: 300, isActive: true }
      ],
      isPrime: false,
      images: [
        'https://res.cloudinary.com/dknzmdxjy/image/upload/v1769955335/petmaza/products/fk5rbzovzgylgzixp8ch.jpg',
        'https://res.cloudinary.com/dknzmdxjy/image/upload/v1769955344/petmaza/products/jdc5gfqlz0xckugl9nhu.jpg'
      ],
      isActive: true
    });

    res.json({
      success: true,
      message: 'Product reseeded with variant IDs',
      data: {
        productId: purepetProduct._id,
        variants: purepetProduct.variants.map(v => ({
          _id: (v as any)._id,
          displayWeight: v.displayWeight,
          sellingPrice: v.sellingPrice
        }))
      }
    });
  } catch (error: any) {
    next(error);
  }
};

// ==================== VENDOR CREATION BY ADMIN ====================

export const createVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, vendorType, phone, serviceablePincodes, shopName } = req.body;

    if (!name || !email || !password || !vendorType) {
      return next(new AppError('Please provide name, email, password and vendor type', 400));
    }

    // Petmaza Quick dark store: where the shop physically is, and how far it
    // delivers. This — not the pincode list — is what decides serviceability
    // once it's set.
    const locationUpdate = parseStoreLocationUpdate(req.body);
    if (locationUpdate.error) {
      return next(new AppError(locationUpdate.error, 400));
    }

    if (!['PRIME', 'MY_SHOP', 'QUICK_SHOP'].includes(vendorType)) {
      return next(new AppError('Invalid vendor type. Must be PRIME, MY_SHOP or QUICK_SHOP', 400));
    }

    // Optional delivery pincodes (Shop Admins): customers only see this shop's
    // Quick products when their pincode is in this list.
    let pincodes: string[] = [];
    if (serviceablePincodes !== undefined) {
      if (!Array.isArray(serviceablePincodes)) {
        return next(new AppError('serviceablePincodes must be an array of 6-digit pincodes', 400));
      }
      pincodes = Array.from(new Set(serviceablePincodes.map((p: any) => String(p).trim()).filter(Boolean)));
      if (pincodes.some((p) => !/^\d{6}$/.test(p))) {
        return next(new AppError('Each pincode must be exactly 6 digits', 400));
      }
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return next(new AppError('A user with this email already exists', 400));
    }

    let primeVendorCode: number | undefined;
    if (vendorType === 'PRIME') {
      const highest = await User.findOne({ primeVendorCode: { $exists: true, $ne: null } })
        .sort({ primeVendorCode: -1 })
        .select('primeVendorCode')
        .lean();
      primeVendorCode = ((highest as any)?.primeVendorCode || 0) + 1;
    }

    const userData: any = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone?.trim() || '0000000000',
      role: 'vendor',
      vendorType,
      isApproved: true,
      isEmailVerified: true,
    };

    if (primeVendorCode !== undefined) {
      userData.primeVendorCode = primeVendorCode;
    }

    const user = await User.create(userData);

    const VendorDetails = (await import('../models/VendorDetails')).default;
    await VendorDetails.create({
      vendor_id: user._id,
      vendorType,
      shopName: shopName?.trim() || `${name.trim()}'s Shop`,
      pickupAddress: {
        street: 'TBD',
        city: 'TBD',
        state: 'TBD',
        pincode: '000000',
      },
      serviceablePincodes: pincodes,
      ...(locationUpdate.set || {}),
      isApproved: true,
      approvedBy: req.user._id,
      approvedAt: new Date(),
    });

    const userResponse = await User.findById(user._id).select('-password');

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      data: { user: userResponse },
    });
  } catch (error: any) {
    next(error);
  }
};

// Fetch a vendor's shop profile (shopName / pickupAddress / serviceablePincodes)
// so Admin can see the same shop details the vendor (e.g. a Shop Admin) filled in.
export const getVendorDetailsById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const VendorDetails = (await import('../models/VendorDetails')).default;
    const details = await VendorDetails.findOne({ vendor_id: id });
    if (!details) {
      return next(new AppError('Vendor details not found', 404));
    }
    res.status(200).json({ success: true, data: details });
  } catch (error: any) {
    next(error);
  }
};

// Admin edits a vendor's account + shop profile: name/phone live on the User,
// while shopName / pickupAddress / serviceablePincodes live on VendorDetails.
// This is what lets Admin fill in a real pickup address so the "TBD" placeholder
// created at signup goes away.
export const updateVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, phone, shopName, pickupAddress, serviceablePincodes } = req.body;

    const user = await User.findById(id);
    if (!user || user.role !== 'vendor') {
      return next(new AppError('Vendor not found', 404));
    }

    const locationUpdate = parseStoreLocationUpdate(req.body);
    if (locationUpdate.error) {
      return next(new AppError(locationUpdate.error, 400));
    }

    // Optional delivery pincodes — validate 6-digit when provided.
    let pincodes: string[] | undefined;
    if (serviceablePincodes !== undefined) {
      if (!Array.isArray(serviceablePincodes)) {
        return next(new AppError('serviceablePincodes must be an array of 6-digit pincodes', 400));
      }
      pincodes = Array.from(new Set(serviceablePincodes.map((p: any) => String(p).trim()).filter(Boolean)));
      if (pincodes.some((p) => !/^\d{6}$/.test(p))) {
        return next(new AppError('Each pincode must be exactly 6 digits', 400));
      }
    }

    if (name !== undefined && String(name).trim()) user.name = String(name).trim();
    if (phone !== undefined) user.phone = String(phone).trim() || '0000000000';
    await user.save();

    const VendorDetails = (await import('../models/VendorDetails')).default;
    const details = await VendorDetails.findOne({ vendor_id: id });
    if (details) {
      if (shopName !== undefined && String(shopName).trim()) details.shopName = String(shopName).trim();
      if (pickupAddress !== undefined && pickupAddress) {
        details.pickupAddress = {
          street: String(pickupAddress.street || '').trim() || details.pickupAddress?.street || 'TBD',
          city: String(pickupAddress.city || '').trim() || details.pickupAddress?.city || 'TBD',
          state: String(pickupAddress.state || '').trim() || details.pickupAddress?.state || 'TBD',
          pincode: String(pickupAddress.pincode || '').trim() || details.pickupAddress?.pincode || '000000',
        };
      }
      if (pincodes !== undefined) details.serviceablePincodes = pincodes;
      if (locationUpdate.clearLocation) details.storeLocation = undefined;
      if (locationUpdate.set?.storeLocation) details.storeLocation = locationUpdate.set.storeLocation;
      if (locationUpdate.set?.deliveryRadiusKm !== undefined) {
        details.deliveryRadiusKm = locationUpdate.set.deliveryRadiusKm;
      }
      await details.save();
    }

    const userResponse = await User.findById(id).select('-password');
    res.status(200).json({ success: true, message: 'Vendor updated', data: { user: userResponse, details } });
  } catch (error: any) {
    next(error);
  }
};

// Admin removes a vendor (e.g. a Shop Admin): deletes the User login and its
// shop profile. Guarded to vendor accounts so admins/customers can't be deleted.
export const deleteVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user || user.role !== 'vendor') {
      return next(new AppError('Vendor not found', 404));
    }
    const VendorDetails = (await import('../models/VendorDetails')).default;
    await VendorDetails.deleteOne({ vendor_id: id });
    await User.deleteOne({ _id: id });
    res.status(200).json({ success: true, message: 'Vendor deleted' });
  } catch (error: any) {
    next(error);
  }
};

// ==================== FULFILLER MANAGEMENT ====================

/**
 * Create a new warehouse fulfiller
 */
export const createFulfiller = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, phone, assignedSubcategories, isActive } = req.body;

    // Validate required fields
    if (!name || !email || !password || !phone) {
      return next(new AppError('Please provide all required fields', 400));
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('User with this email already exists', 400));
    }

    // Create user with WAREHOUSE_FULFILLER role
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: 'vendor',
      vendorType: 'WAREHOUSE_FULFILLER',
      isApproved: isActive !== undefined ? isActive : true,
    });

    // Import VendorDetails model
    const VendorDetails = (await import('../models/VendorDetails')).default;

    // Create vendor details with subcategories
    const vendorDetails = await VendorDetails.create({
      vendor_id: user._id,
      vendorType: 'WAREHOUSE_FULFILLER',
      shopName: `${name} Warehouse`,
      assignedSubcategories: assignedSubcategories || [],
      pickupAddress: {
        street: 'TBD',
        city: 'TBD',
        state: 'TBD',
        pincode: '000000',
      },
      isApproved: isActive !== undefined ? isActive : true,
      approvedBy: req.user._id,
      approvedAt: new Date(),
    });

    // Return user without password
    const userResponse = await User.findById(user._id).select('-password');

    res.status(201).json({
      success: true,
      message: 'Fulfiller created successfully',
      data: {
        user: userResponse,
        vendorDetails,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get all warehouse fulfillers
 */
export const getFulfillers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Find all warehouse fulfiller users
    const users = await User.find({
      role: 'vendor',
      vendorType: 'WAREHOUSE_FULFILLER',
    })
      .select('-password')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    // Get vendor details for each fulfiller
    const VendorDetails = (await import('../models/VendorDetails')).default;
    const userIds = users.map(u => u._id);
    const vendorDetails = await VendorDetails.find({
      vendor_id: { $in: userIds },
    });

    // Combine user and vendor details
    const fulfillers = users.map(user => {
      const details = vendorDetails.find(
        vd => vd.vendor_id.toString() === user._id.toString()
      );
      return {
        ...user.toObject(),
        assignedSubcategories: details?.assignedSubcategories || [],
        vendorDetails: details,
      };
    });

    const total = await User.countDocuments({
      role: 'vendor',
      vendorType: 'WAREHOUSE_FULFILLER',
    });

    res.status(200).json({
      success: true,
      data: {
        fulfillers,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Update a fulfiller
 */
export const updateFulfiller = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, email, phone, assignedSubcategories, isActive, password } = req.body;

    // Find user
    const user = await User.findById(id);
    if (!user) {
      return next(new AppError('Fulfiller not found', 404));
    }

    if (user.vendorType !== 'WAREHOUSE_FULFILLER') {
      return next(new AppError('User is not a warehouse fulfiller', 400));
    }

    // Update user fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (password) user.password = password; // Will be hashed by pre-save hook
    if (isActive !== undefined) user.isApproved = isActive;

    await user.save();

    // Update vendor details
    const VendorDetails = (await import('../models/VendorDetails')).default;
    const vendorDetails = await VendorDetails.findOneAndUpdate(
      { vendor_id: id },
      {
        assignedSubcategories: assignedSubcategories || [],
        isApproved: isActive !== undefined ? isActive : true,
      },
      { new: true }
    );

    // Return user without password
    const userResponse = await User.findById(id).select('-password');

    res.status(200).json({
      success: true,
      message: 'Fulfiller updated successfully',
      data: {
        user: userResponse,
        vendorDetails,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Delete a fulfiller
 */
export const deleteFulfiller = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Find user
    const user = await User.findById(id);
    if (!user) {
      return next(new AppError('Fulfiller not found', 404));
    }

    if (user.vendorType !== 'WAREHOUSE_FULFILLER') {
      return next(new AppError('User is not a warehouse fulfiller', 400));
    }

    // Delete vendor details
    const VendorDetails = (await import('../models/VendorDetails')).default;
    await VendorDetails.findOneAndDelete({ vendor_id: id });

    // Delete user
    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Fulfiller deleted successfully',
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get vendor weekly billing / invoice data grouped by vendor + week
 */
export const getVendorWeeklyBilling = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { week, vendorId, status } = req.query;

    // Helper: get week boundaries (Mon–Sun) for a given date
    const getWeekRange = (date: Date): { start: Date; end: Date; label: string } => {
      const d = new Date(date);
      const day = d.getDay(); // 0=Sun
      const diffToMon = day === 0 ? -6 : 1 - day;
      const mon = new Date(d);
      mon.setDate(d.getDate() + diffToMon);
      mon.setHours(0, 0, 0, 0);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      sun.setHours(23, 59, 59, 999);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label =
        mon.getMonth() === sun.getMonth()
          ? `${months[mon.getMonth()]} ${mon.getDate()}–${sun.getDate()}`
          : `${months[mon.getMonth()]} ${mon.getDate()} – ${months[sun.getMonth()]} ${sun.getDate()}`;
      return { start: mon, end: sun, label };
    };

    // Settlement weekStart values may have been saved under a different server
    // timezone (e.g. UTC on the live host vs IST locally), which shifts the raw
    // timestamp a few hours across midnight and breaks exact date matching.
    // Snap any timestamp to the Monday of its week (with a 12h buffer so
    // near-midnight offsets land on the correct week) and key by that date.
    const weekKeyDate = (date: Date): string => {
      const d = new Date(date.getTime() + 12 * 60 * 60 * 1000);
      const day = d.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diffToMon);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    // An order is payable to its vendors from the moment it ships, and each
    // vendor is billed only for THEIR line items — see VendorPayoutService.
    const orderFilter: any = {
      status: { $in: PAYABLE_STATUSES },
      payment_status: { $nin: ['Failed', 'Refunded'] },
    };

    const orders = await Order.find(orderFilter)
      .populate('assignedVendorId', 'name email phone vendorType')
      .populate('items.vendor_id', 'name email phone vendorType')
      .populate('customer_id', 'name email phone')
      .populate('items.product_id', 'name images')
      .populate('items.primeProduct_id', 'name images')
      .sort({ createdAt: -1 })
      .lean();

    // Courier cost is reimbursed only when the VENDOR booked the courier. When
    // an admin arranged shipping, Petmaza paid it directly and the vendor is
    // owed the product price alone.
    const shippingDocs = await ShippingDetails.find({ order_id: { $in: orders.map((o) => o._id) } })
      .select('order_id vendor_id shipping_cost shipping_arranged_by created_at')
      .lean();
    const shippingByOrder = new Map<string, ShippingDetailsLike>(
      shippingDocs.map((sd) => [sd.order_id.toString(), sd as unknown as ShippingDetailsLike])
    );

    // Already-settled payouts (paid from either the daily or the weekly screen).
    const paidPayouts = await VendorPayout.find({ order_id: { $in: orders.map((o) => o._id) } })
      .lean();
    const paidByOrderVendor = new Map<string, any>(
      paidPayouts.map((p) => [`${p.order_id.toString()}_${p.vendor_id.toString()}`, p])
    );

    // Vendor display info, per-item first then the order-level assignment.
    const vendorInfo = new Map<string, any>();
    for (const order of orders) {
      const assigned = order.assignedVendorId as any;
      if (assigned?._id) vendorInfo.set(assigned._id.toString(), assigned);
      for (const item of (order as any).items || []) {
        const v = item.vendor_id;
        if (v?._id) vendorInfo.set(v._id.toString(), v);
      }
    }

    // Group by vendor + week key
    const groupMap: Record<string, any> = {};

    for (const order of orders) {
      const shippingDoc = shippingByOrder.get(order._id.toString()) || null;
      // Group by the week the order became payable (shipped), falling back to
      // delivery/last-update for legacy orders with no courier record.
      const billingDate = payableDateOf(order, shippingDoc);
      const weekInfo = getWeekRange(billingDate);

      for (const payout of computeOrderPayouts(order, shippingDoc)) {
        if (vendorId && payout.vendorId !== String(vendorId)) continue;

        const weekKey = `${payout.vendorId}_${weekInfo.start.toISOString().slice(0, 10)}`;
        const settled = paidByOrderVendor.get(`${order._id.toString()}_${payout.vendorId}`);

        if (!groupMap[weekKey]) {
          const vendor = vendorInfo.get(payout.vendorId);
          const typeLabel =
            vendor?.vendorType === 'PRIME'
              ? 'Prime Vendor'
              : vendor?.vendorType === 'MY_SHOP'
              ? 'My Shop'
              : vendor?.vendorType === 'WAREHOUSE_FULFILLER'
              ? 'Fulfiller'
              : vendor?.vendorType === 'QUICK'
              ? 'Quick Shop'
              : vendor?.vendorType || 'Vendor';

          groupMap[weekKey] = {
            id: weekKey,
            weekStart: weekInfo.start.toISOString(),
            weekEnd: weekInfo.end.toISOString(),
            weekLabel: weekInfo.label,
            vendorId: payout.vendorId,
            vendorName: vendor?.name || 'Unknown Vendor',
            vendorEmail: vendor?.email || null,
            vendorPhone: vendor?.phone || null,
            vendorType: typeLabel,
            totalAmount: 0,
            pendingAmount: 0,
            paidAmount: 0,
            paidAt: null,
            status: 'Pending', // recomputed below from per-order settlement
            orders: [],
          };
        }

        // A settled payout reports its frozen figures, not a recomputation.
        const orderPayout = settled ? settled.totalAmount : payout.totalAmount;
        const reimbursement = settled ? settled.shippingReimbursement : payout.shippingReimbursement;

        const entry = groupMap[weekKey];
        entry.totalAmount += orderPayout;
        if (settled) {
          entry.paidAmount += orderPayout;
          if (!entry.paidAt) entry.paidAt = settled.paidAt ? new Date(settled.paidAt).toISOString() : null;
        } else {
          entry.pendingAmount += orderPayout;
        }

        entry.orders.push({
          orderId: order._id.toString(),
          orderDate: order.createdAt,
          shippedAt: shippingDoc?.created_at || null,
          deliveredAt: (order as any).deliveredAt || null,
          orderStatus: order.status,
          paymentStatus: (order as any).payment_status || 'Pending',
          // Kept as `deliveryCharge` for the existing web table column, but it
          // is now the reimbursable amount only — ₹0 on admin-arranged shipping.
          deliveryCharge: reimbursement,
          shippingArrangedBy: payout.shippingArrangedBy,
          shippingCost: payout.shippingCost,
          items: payout.items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity,
            price: i.purchasePrice,
            total: i.purchaseSubtotal,
            priceAdjusted: i.priceAdjusted,
            quotedPrice: i.quotedPrice,
          })),
          grandTotal: orderPayout,
          status: settled ? 'Paid' : 'Pending',
          paidAt: settled?.paidAt || null,
        });
      }
    }

    let invoices = Object.values(groupMap);

    // A week is Paid only when every order in it has been settled — so an order
    // already paid on the daily screen can never be paid again from here.
    for (const inv of invoices) {
      const paidCount = inv.orders.filter((o: any) => o.status === 'Paid').length;
      inv.status =
        paidCount === 0 ? 'Pending' : paidCount === inv.orders.length ? 'Paid' : 'Partially Paid';
    }

    // Legacy Settlement records predate per-order payouts: honour them as a
    // fallback so weeks settled before this change still read as Paid.
    const vendorIds = [...new Set(invoices.map((inv) => inv.vendorId.toString()))];
    const settlements = await Settlement.find({ vendorId: { $in: vendorIds } }).lean();
    logger.info(`[getVendorWeeklyBilling] Found ${settlements.length} legacy settlement(s) for ${vendorIds.length} vendor(s)`);

    const settlementMap: Record<string, any> = {};
    for (const s of settlements) {
      const key = `${s.vendorId.toString()}_${weekKeyDate(new Date(s.weekStart))}`;
      if (!settlementMap[key] || s.status === 'paid') settlementMap[key] = s;
    }

    for (const inv of invoices) {
      if (inv.status === 'Paid') continue;
      const key = `${inv.vendorId.toString()}_${weekKeyDate(new Date(inv.weekStart))}`;
      const settlement = settlementMap[key];
      if (settlement && settlement.status === 'paid') {
        inv.status = 'Paid';
        inv.paidAt = settlement.processedAt ? settlement.processedAt.toISOString() : null;
      }
    }

    // Apply status filter
    if (status) {
      invoices = invoices.filter((inv) => inv.status === status);
    }
    // Apply week filter (match weekLabel or weekStart date prefix)
    if (week) {
      invoices = invoices.filter(
        (inv) =>
          inv.weekLabel.toLowerCase().includes((week as string).toLowerCase()) ||
          inv.weekStart.slice(0, 10) === week
      );
    }

    res.status(200).json({ success: true, data: invoices });
  } catch (error: any) {
    logger.error('[getVendorWeeklyBilling] Error:', error);
    next(error);
  }
};

/**
 * Mark a weekly invoice entry as Paid
 */
export const markWeeklyInvoicePaid = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { weekStart, vendorId, totalAmount, orderIds } = req.body;

    if (!weekStart || !vendorId) {
      return res.status(400).json({ success: false, message: 'weekStart and vendorId are required' });
    }

    const paidAt = new Date();
    const weekStartDate = new Date(weekStart);
    const amountPaid = Number(totalAmount) || 0;
    // Keep only valid ObjectId strings so this audit field can never break the payout.
    const settledOrders = (Array.isArray(orderIds) ? orderIds : []).filter(
      (id: any) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)
    );

    // Find existing settlement or create new one — avoids $setOnInsert path-conflict errors.
    // Match weekStart within ±1 day: the same week's timestamp can differ by a few
    // hours if it was saved while the server ran in another timezone (UTC vs IST),
    // and an exact match would create a duplicate settlement instead of updating.
    const dayMs = 24 * 60 * 60 * 1000;
    const existing = await Settlement.findOne({
      vendorId,
      weekStart: {
        $gte: new Date(weekStartDate.getTime() - dayMs),
        $lte: new Date(weekStartDate.getTime() + dayMs),
      },
    });

    if (existing) {
      existing.status = 'paid';
      existing.processedAt = paidAt;
      existing.totalDue = amountPaid;
      if (settledOrders.length) existing.orders = settledOrders as any;
      await existing.save();
    } else {
      await Settlement.create({
        vendorId,
        weekStart: weekStartDate,
        status: 'paid',
        processedAt: paidAt,
        totalDue: amountPaid,
        orders: settledOrders,
      });
    }

    logger.info(`[markWeeklyInvoicePaid] Saved: vendorId=${vendorId} weekStart=${weekStartDate.toISOString()}`);

    // Also write a per-order VendorPayout snapshot for every order in the week.
    // This is what stops the same order being paid twice from the daily screen:
    // (order_id, vendor_id) is unique, so whichever screen settles it first wins
    // and the other reports it as already paid.
    let payoutsWritten = 0;
    let actuallyPaid = 0;
    if (settledOrders.length) {
      const orders = await Order.find({ _id: { $in: settledOrders } })
        .populate('items.product_id', 'name')
        .populate('items.primeProduct_id', 'name');
      const shippingDocs = await ShippingDetails.find({ order_id: { $in: settledOrders } })
        .select('order_id vendor_id shipping_cost shipping_arranged_by created_at')
        .lean();
      const shippingByOrder = new Map<string, ShippingDetailsLike>(
        shippingDocs.map((sd) => [sd.order_id.toString(), sd as unknown as ShippingDetailsLike])
      );

      for (const order of orders) {
        const shippingDoc = shippingByOrder.get(order._id.toString()) || null;
        const payout = computeVendorPayoutForOrder(order, String(vendorId), shippingDoc);
        if (!payout) continue;
        try {
          await VendorPayout.create({
            order_id: order._id,
            vendor_id: vendorId,
            items: payout.items.map((i) => ({
              product_id: /^[a-f\d]{24}$/i.test(i.productId) ? i.productId : undefined,
              productName: i.productName,
              quantity: i.quantity,
              purchasePrice: i.purchasePrice,
              purchaseSubtotal: i.purchaseSubtotal,
            })),
            productAmount: payout.productAmount,
            shippingArrangedBy: payout.shippingArrangedBy,
            shippingCost: payout.shippingCost,
            shippingReimbursement: payout.shippingReimbursement,
            totalAmount: payout.totalAmount,
            payableDate: payableDateOf(order, shippingDoc),
            status: 'paid',
            paidAt,
            paidBy: req.user._id,
            paymentMethod: 'weekly-invoice',
          });
          payoutsWritten += 1;
          actuallyPaid += payout.totalAmount;
        } catch (err: any) {
          // 11000 = already settled for this vendor; nothing more to do.
          if (err?.code !== 11000) throw err;
        }
      }
    }

    // Refresh the cached wallet. The balance is derived from unpaid payouts, so
    // the records just written drop out of it — no more blanket reset to ₹0,
    // which used to wipe anything still owed from other weeks.
    try {
      const { WalletService } = await import('../services/WalletService');
      const wallet = await WalletService.resetWallet(vendorId);
      logger.info(`[markWeeklyInvoicePaid] Paid ₹${actuallyPaid}, ₹${wallet.balance} still outstanding for vendorId=${vendorId}`);
    } catch (walletError: any) {
      // Non-blocking — don't fail the invoice marking if the wallet update fails
      logger.error('[markWeeklyInvoicePaid] Wallet update failed:', walletError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Invoice marked as paid',
      paidAt,
      data: { payoutsWritten, totalPaid: actuallyPaid },
    });
  } catch (error: any) {
    logger.error('[markWeeklyInvoicePaid] Error:', error.message);
    next(error);
  }
};

/**
 * Get vendor billing data for admin dashboard
 * Shows orders fulfilled by each vendor type and their revenue/profit
 */
export const getVendorBilling = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    // Get all vendors with their details
    const vendors = await User.find({
      role: 'vendor',
      vendorType: { $in: ['PRIME', 'MY_SHOP', 'WAREHOUSE_FULFILLER'] }
    }).select('name email vendorType isApproved phone address pincodesServed').lean();

    // Import VendorDetails model
    const VendorDetails = require('../models/VendorDetails').default;

    // Get vendor details for each vendor
    const vendorDetailsMap: any = {};
    for (const vendor of vendors) {
      const details = await VendorDetails.findOne({ vendor_id: vendor._id })
        .populate('brandsHandled', 'name')
        .lean();
      if (details) {
        vendorDetailsMap[vendor._id.toString()] = details;
      }
    }

    logger.info('[getVendorBilling] Total vendors found:', vendors.length);
    logger.info('[getVendorBilling] Vendor types:', vendors.map(v => v.vendorType));

    // Get all orders assigned to or fulfilled by vendors
    // Include: PENDING (with vendor), ASSIGNED, ACCEPTED, PACKED, PICKED_UP, IN_TRANSIT, DELIVERED
    // This shows orders that have been assigned to vendors (either auto-assigned or accepted)
    const orderFilter = {
      ...dateFilter,
      assignedVendorId: { $exists: true, $ne: null },
      status: { $nin: ['CANCELLED', 'REJECTED'] } // Exclude only cancelled/rejected
    };

    const orders = await Order.find(orderFilter)
      .populate('assignedVendorId', 'name email vendorType')
      .populate('customer_id', 'name email phone')
      .populate('items.product_id', 'name category brand')
      .populate('items.primeProduct_id', 'name brand')
      .sort({ createdAt: -1 })
      .lean();

    logger.info('[getVendorBilling] Total orders found:', orders.length);
    logger.info('[getVendorBilling] Order filter:', JSON.stringify(orderFilter));
    if (orders.length > 0) {
      logger.info('[getVendorBilling] First order status:', orders[0].status);
      logger.info('[getVendorBilling] First order has assignedVendorId:', !!orders[0].assignedVendorId);
    } else {
      // Debug: Check what orders exist in total
      const totalOrders = await Order.countDocuments(dateFilter);
      const ordersWithVendor = await Order.countDocuments({ 
        ...dateFilter, 
        assignedVendorId: { $exists: true, $ne: null } 
      });
      logger.info('[getVendorBilling] DEBUG - Total orders in DB:', totalOrders);
      logger.info('[getVendorBilling] DEBUG - Orders with assignedVendorId:', ordersWithVendor);
      
      // Check status distribution
      const statusCounts = await Order.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      logger.info('[getVendorBilling] DEBUG - Order status distribution:', statusCounts);
    }

    // Calculate stats by vendor type
    const vendorTypeStats: any = {};
    const vendorStats: any = {};
    const detailedOrders: any[] = [];
    const orderStatusByType: any = {};

    // Initialize vendor stats with details
    vendors.forEach(vendor => {
      const vendorId = vendor._id.toString();
      const details = vendorDetailsMap[vendorId];
      
      vendorStats[vendorId] = {
        _id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        vendorType: vendor.vendorType,
        isApproved: vendor.isApproved,
        totalOrders: 0,
        totalRevenue: 0,
        platformProfit: 0,
        ordersByStatus: {},
        commissionRate: vendor.vendorType === 'PRIME' ? '10%' : vendor.vendorType === 'MY_SHOP' ? '15%' : '₹10/order',
        // Add vendor details
        shopName: details?.shopName || 'N/A',
        businessType: details?.businessType || 'N/A',
        serviceablePincodes: details?.serviceablePincodes || vendor.pincodesServed || [],
        pickupAddress: details?.pickupAddress || vendor.address || null,
        brandsHandled: details?.brandsHandled || [],
        assignedSubcategories: details?.assignedSubcategories || [],
        rating: details?.rating || 0,
        completedOrders: details?.completedOrders || 0,
        totalPrimeProducts: details?.totalPrimeProducts || 0,
        activePrimeProducts: details?.activePrimeProducts || 0,
        yearsInBusiness: details?.yearsInBusiness || 0,
        averageDeliveryTime: details?.averageDeliveryTime || 'N/A',
      };

      // Initialize vendor type stats
      if (!vendorTypeStats[vendor.vendorType]) {
        vendorTypeStats[vendor.vendorType] = {
          vendorType: vendor.vendorType,
          totalVendors: 0,
          totalOrders: 0,
          totalRevenue: 0,
          totalProfit: 0,
          ordersByStatus: {},
        };
      }
      vendorTypeStats[vendor.vendorType].totalVendors += 1;

      // Initialize order status by type
      if (!orderStatusByType[vendor.vendorType]) {
        orderStatusByType[vendor.vendorType] = {};
      }
    });

    // Calculate revenue and profit from orders
    orders.forEach(order => {
      const vendor = order.assignedVendorId as any;
      if (!vendor || !vendor._id) return;

      const vendorId = vendor._id.toString();
      const vendorType = vendor.vendorType;
      const orderTotal = order.total || 0;
      const orderStatus = order.status;

      // Platform profit calculation:
      // For PRIME vendors: 10% platform fee
      // For MY_SHOP: 15% commission
      // For FULFILLER: Fixed ₹10 per order
      let platformProfit = 0;
      if (vendorType === 'PRIME') {
        platformProfit = orderTotal * 0.10; // 10% platform fee
      } else if (vendorType === 'MY_SHOP') {
        platformProfit = orderTotal * 0.15; // 15% commission
      } else if (vendorType === 'WAREHOUSE_FULFILLER') {
        platformProfit = 10; // ₹10 per order
      }

      // Update vendor stats
      if (vendorStats[vendorId]) {
        vendorStats[vendorId].totalOrders += 1;
        vendorStats[vendorId].totalRevenue += orderTotal;
        vendorStats[vendorId].platformProfit += platformProfit;
        
        // Track orders by status
        if (!vendorStats[vendorId].ordersByStatus[orderStatus]) {
          vendorStats[vendorId].ordersByStatus[orderStatus] = 0;
        }
        vendorStats[vendorId].ordersByStatus[orderStatus] += 1;
      }

      // Update vendor type stats
      if (vendorTypeStats[vendorType]) {
        vendorTypeStats[vendorType].totalOrders += 1;
        vendorTypeStats[vendorType].totalRevenue += orderTotal;
        vendorTypeStats[vendorType].totalProfit += platformProfit;

        // Track orders by status for vendor type
        if (!vendorTypeStats[vendorType].ordersByStatus[orderStatus]) {
          vendorTypeStats[vendorType].ordersByStatus[orderStatus] = 0;
        }
        vendorTypeStats[vendorType].ordersByStatus[orderStatus] += 1;
      }

      // Add to detailed orders for CSV export
      const customer = order.customer_id as any;
      
      // Extract product names from items
      let productNames = 'N/A';
      if (order.items && Array.isArray(order.items)) {
        productNames = order.items
          .map((item: any) => {
            const product = item.product_id || item.primeProduct_id;
            return product?.name || 'Unknown Product';
          })
          .filter((name: string) => name !== 'Unknown Product')
          .join(', ') || 'N/A';
      }
      
      detailedOrders.push({
        orderId: (order as any).order_id || order._id,
        orderDate: order.createdAt,
        vendorId: vendorId,
        vendorName: vendor.name,
        vendorEmail: vendor.email,
        vendorType: vendorType,
        customerName: customer?.name || 'N/A',
        customerEmail: customer?.email || 'N/A',
        products: productNames,
        orderStatus: orderStatus,
        orderTotal: orderTotal,
        platformProfit: platformProfit,
        paymentStatus: order.payment_status || 'N/A',
      });
    });

    // Convert objects to arrays
    const byVendorType: any[] = Object.values(vendorTypeStats) as any[];
    const vendorList = Object.values(vendorStats); // Show all vendors, not just those with orders

    // Calculate summary
    const summary = {
      totalVendors: vendors.length,
      totalOrders: orders.length,
      totalRevenue: byVendorType.reduce((sum: number, item: any) => sum + item.totalRevenue, 0),
      totalProfit: byVendorType.reduce((sum: number, item: any) => sum + item.totalProfit, 0),
      pendingSettlement: (byVendorType as any[]).reduce((sum: number, item: any) => sum + item.totalRevenue - item.totalProfit, 0),
      averageOrderValue: orders.length > 0 ? byVendorType.reduce((sum: number, item: any) => sum + item.totalRevenue, 0) / orders.length : 0,
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        byVendorType,
        vendors: vendorList,
        detailedOrders, // For CSV export
      },
    });
  } catch (error: any) {
    logger.error('[getVendorBilling] Error:', error);
    next(error);
  }
};

/**
 * GET /admin/quick-billing
 * Petmaza Quick counterpart of getVendorBilling: billing & settlement figures
 * for QUICK_SHOP vendors, built only from QUICK-channel orders. Platform profit
 * here is the real platformFee charged on the order (not a commission %),
 * because Quick charges are computed at checkout and stored on the order.
 */
export const getQuickBilling = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    const vendors = await User.find({
      role: 'vendor',
      vendorType: 'QUICK_SHOP',
    }).select('name email vendorType isApproved phone address pincodesServed').lean();

    const VendorDetails = require('../models/VendorDetails').default;
    const QuickProductListing = require('../models/QuickProductListing').default;

    const vendorDetailsMap: any = {};
    for (const vendor of vendors) {
      const details = await VendorDetails.findOne({ vendor_id: vendor._id }).lean();
      if (details) {
        vendorDetailsMap[vendor._id.toString()] = details;
      }
    }

    // Listing counts per shop — the Quick equivalent of "prime products".
    const listingCounts = await QuickProductListing.aggregate([
      {
        $group: {
          _id: '$vendor_id',
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
          inStock: { $sum: { $cond: [{ $gt: ['$stock', 0] }, 1, 0] } },
        },
      },
    ]);
    const listingCountMap: any = {};
    listingCounts.forEach((row: any) => {
      listingCountMap[row._id.toString()] = row;
    });

    const orderFilter = {
      ...dateFilter,
      orderChannel: 'QUICK',
      assignedVendorId: { $exists: true, $ne: null },
      status: { $nin: ['CANCELLED', 'REJECTED'] },
    };

    const orders = await Order.find(orderFilter)
      .populate('assignedVendorId', 'name email vendorType')
      .populate('customer_id', 'name email phone')
      .populate('items.product_id', 'name category brand')
      .sort({ createdAt: -1 })
      .lean();

    logger.info('[getQuickBilling] Shops found:', vendors.length);
    logger.info('[getQuickBilling] Quick orders found:', orders.length);

    const deliveryModeStats: any = {};
    const vendorStats: any = {};
    const detailedOrders: any[] = [];

    vendors.forEach(vendor => {
      const vendorId = vendor._id.toString();
      const details = vendorDetailsMap[vendorId];
      const listings = listingCountMap[vendorId];

      vendorStats[vendorId] = {
        _id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        vendorType: vendor.vendorType,
        isApproved: vendor.isApproved,
        totalOrders: 0,
        totalRevenue: 0,
        platformProfit: 0,
        shopEarnings: 0,
        ordersByStatus: {},
        ordersByDeliveryMode: {},
        shopName: details?.shopName || 'N/A',
        businessType: details?.businessType || 'N/A',
        serviceablePincodes: details?.serviceablePincodes || vendor.pincodesServed || [],
        // Dark-store coverage — the billing list shows "4 km radius" for located
        // stores and falls back to the pincode count for ones without a pin.
        storeLocation: details?.storeLocation || null,
        deliveryRadiusKm: details?.deliveryRadiusKm ?? null,
        pickupAddress: details?.pickupAddress || vendor.address || null,
        rating: details?.rating || 0,
        completedOrders: details?.completedOrders || 0,
        totalListings: listings?.total || 0,
        activeListings: listings?.active || 0,
        inStockListings: listings?.inStock || 0,
        yearsInBusiness: details?.yearsInBusiness || 0,
        averageDeliveryTime: details?.averageDeliveryTime || 'N/A',
      };
    });

    orders.forEach(order => {
      const vendor = order.assignedVendorId as any;
      if (!vendor || !vendor._id) return;

      const vendorId = vendor._id.toString();
      const orderTotal = order.total || 0;
      const orderStatus = order.status;
      // Quick now books fixed slots; group by the booked (or requested) window,
      // falling back to the retired speed picker for pre-slot orders.
      const deliveryMode =
        (order as any).quickBookedSlot ||
        (order as any).quickDeliverySlot ||
        (order as any).quickDeliveryMode ||
        'UNSPECIFIED';

      // Platform keeps the platform fee; the shop is owed the item subtotal.
      const platformProfit = (order as any).platformFee || 0;
      const shopEarnings = (order as any).subtotalBeforeCharges ?? orderTotal;

      if (vendorStats[vendorId]) {
        const stats = vendorStats[vendorId];
        stats.totalOrders += 1;
        stats.totalRevenue += orderTotal;
        stats.platformProfit += platformProfit;
        stats.shopEarnings += shopEarnings;
        stats.ordersByStatus[orderStatus] = (stats.ordersByStatus[orderStatus] || 0) + 1;
        stats.ordersByDeliveryMode[deliveryMode] = (stats.ordersByDeliveryMode[deliveryMode] || 0) + 1;
      }

      if (!deliveryModeStats[deliveryMode]) {
        deliveryModeStats[deliveryMode] = {
          deliveryMode,
          totalShops: 0,
          totalOrders: 0,
          totalRevenue: 0,
          totalProfit: 0,
          ordersByStatus: {},
          _shopIds: new Set<string>(),
        };
      }
      const modeStats = deliveryModeStats[deliveryMode];
      modeStats.totalOrders += 1;
      modeStats.totalRevenue += orderTotal;
      modeStats.totalProfit += platformProfit;
      modeStats.ordersByStatus[orderStatus] = (modeStats.ordersByStatus[orderStatus] || 0) + 1;
      modeStats._shopIds.add(vendorId);

      const customer = order.customer_id as any;

      let productNames = 'N/A';
      if (order.items && Array.isArray(order.items)) {
        productNames = order.items
          .map((item: any) => (item.product_id as any)?.name || 'Unknown Product')
          .filter((name: string) => name !== 'Unknown Product')
          .join(', ') || 'N/A';
      }

      detailedOrders.push({
        orderId: (order as any).order_id || order._id,
        orderDate: order.createdAt,
        vendorId,
        vendorName: vendor.name,
        vendorEmail: vendor.email,
        shopName: vendorStats[vendorId]?.shopName || 'N/A',
        deliveryMode,
        customerName: customer?.name || 'N/A',
        customerEmail: customer?.email || 'N/A',
        products: productNames,
        orderStatus,
        orderTotal,
        platformProfit,
        shopEarnings,
        paymentStatus: order.payment_status || 'N/A',
      });
    });

    const byDeliveryMode: any[] = (Object.values(deliveryModeStats) as any[]).map((mode: any) => {
      const { _shopIds, ...rest } = mode;
      return { ...rest, totalShops: _shopIds.size };
    });

    const vendorList = Object.values(vendorStats);

    const totalRevenue = byDeliveryMode.reduce((sum: number, item: any) => sum + item.totalRevenue, 0);
    const totalProfit = byDeliveryMode.reduce((sum: number, item: any) => sum + item.totalProfit, 0);

    const summary = {
      totalVendors: vendors.length,
      totalOrders: orders.length,
      totalRevenue,
      totalProfit,
      pendingSettlement: (vendorList as any[]).reduce((sum: number, v: any) => sum + v.shopEarnings, 0),
      averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        byDeliveryMode,
        vendors: vendorList,
        detailedOrders,
      },
    });
  } catch (error: any) {
    logger.error('[getQuickBilling] Error:', error);
    next(error);
  }
};

// ─── Category → Fulfiller Mapping ────────────────────────────────────────────

/**
 * GET /admin/category-mappings
 * Returns all category→fulfiller mappings with fulfiller details populated.
 */
export const getCategoryMappings = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const mappings = await CategoryFulfillerMapping.find({})
      .populate('fulfiller_id', 'name email')
      .sort({ mainCategory: 1, subCategory: 1 })
      .lean();

    res.status(200).json({ success: true, data: mappings });
  } catch (err: any) {
    next(err);
  }
};

/**
 * POST /admin/category-mappings
 * Create or update a category→fulfiller mapping (upsert).
 * Body: { mainCategory, subCategory?, fulfiller_id }
 */
export const upsertCategoryMapping = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { mainCategory, subCategory, fulfiller_id } = req.body;

    if (!mainCategory || !fulfiller_id) {
      return next(new AppError('mainCategory and fulfiller_id are required', 400));
    }

    // Verify the fulfiller exists and is a WAREHOUSE_FULFILLER
    const fulfiller = await User.findOne({
      _id: fulfiller_id,
      role: 'vendor',
      vendorType: 'WAREHOUSE_FULFILLER',
    }).select('name');

    if (!fulfiller) {
      return next(
        new AppError('Fulfiller not found or is not a WAREHOUSE_FULFILLER', 404)
      );
    }

    const filter: Record<string, any> = { mainCategory };
    filter.subCategory = subCategory?.trim() || null;

    const update = {
      fulfiller_id,
      fulfillerName: fulfiller.name,
      isActive: true,
    };

    const mapping = await CategoryFulfillerMapping.findOneAndUpdate(
      filter,
      { $set: update },
      { new: true, upsert: true, runValidators: true }
    );

    // ── Issue 3 Fix: Sync VendorDetails.assignedSubcategories ──
    // The order-routing service reads assignedSubcategories from VendorDetails
    // to decide which fulfiller handles which products. We must keep it in sync
    // with CategoryFulfillerMapping whenever an admin creates/updates a mapping.
    if (subCategory?.trim()) {
      const VendorDetails = (await import('../models/VendorDetails')).default;
      await VendorDetails.findOneAndUpdate(
        { vendor_id: fulfiller_id },
        { $addToSet: { assignedSubcategories: subCategory.trim() } },
        { new: true }
      );
      logger.info(`[upsertCategoryMapping] ✅ Added '${subCategory.trim()}' to ${fulfiller.name}'s assignedSubcategories`);
    }

    logger.info(`[upsertCategoryMapping] ✅ Mapping saved: ${mainCategory} / ${subCategory || '*'} → ${fulfiller.name}`);

    res.status(200).json({
      success: true,
      message: 'Category mapping saved successfully',
      data: mapping,
    });
  } catch (err: any) {
    next(err);
  }
};

/**
 * DELETE /admin/category-mappings/:id
 */
export const deleteCategoryMapping = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const mapping = await CategoryFulfillerMapping.findByIdAndDelete(req.params.id);
    if (!mapping) {
      return next(new AppError('Mapping not found', 404));
    }

    // ── Issue 3 Fix: Remove subcategory from VendorDetails.assignedSubcategories ──
    if (mapping.subCategory) {
      const VendorDetails = (await import('../models/VendorDetails')).default;
      await VendorDetails.findOneAndUpdate(
        { vendor_id: mapping.fulfiller_id },
        { $pull: { assignedSubcategories: mapping.subCategory } }
      );
      logger.info(`[deleteCategoryMapping] ✅ Removed '${mapping.subCategory}' from fulfiller ${mapping.fulfiller_id}'s assignedSubcategories`);
    }

    res.status(200).json({ success: true, message: 'Mapping deleted' });
  } catch (err: any) {
    next(err);
  }
};

/**
 * PATCH /admin/category-mappings/:id/toggle
 * Toggle isActive on a mapping.
 */
export const toggleCategoryMapping = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const mapping = await CategoryFulfillerMapping.findById(req.params.id);
    if (!mapping) {
      return next(new AppError('Mapping not found', 404));
    }
    mapping.isActive = !mapping.isActive;
    await mapping.save();
    res.status(200).json({
      success: true,
      message: `Mapping ${mapping.isActive ? 'activated' : 'deactivated'}`,
      data: mapping,
    });
  } catch (err: any) {
    next(err);
  }
};

/**
 * Sync all active CategoryFulfillerMapping entries → VendorDetails.assignedSubcategories
 * One-time migration endpoint for existing fulfillers.
 */
export const syncCategoryMappings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const mappings = await CategoryFulfillerMapping.find({
      isActive: true,
      subCategory: { $ne: null },
    });

    const grouped: Record<string, string[]> = {};
    mappings.forEach((m: any) => {
      const key = m.fulfiller_id.toString();
      if (!grouped[key]) grouped[key] = [];
      if (!grouped[key].includes(m.subCategory)) {
        grouped[key].push(m.subCategory);
      }
    });

    const VendorDetails = (await import('../models/VendorDetails')).default;

    let syncedCount = 0;
    for (const [fulfillerId, subcategories] of Object.entries(grouped)) {
      await VendorDetails.findOneAndUpdate(
        { vendor_id: fulfillerId },
        { $addToSet: { assignedSubcategories: { $each: subcategories } } },
        { upsert: false }
      );
      syncedCount++;
    }

    res.status(200).json({
      success: true,
      message: `Synced ${mappings.length} mappings across ${syncedCount} fulfillers`,
      data: { syncedFulfillers: syncedCount, totalMappings: mappings.length },
    });
  } catch (err: any) {
    next(err);
  }
};