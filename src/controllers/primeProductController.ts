/**
 * primeProductController.ts
 *
 * After the Product+PrimeProduct unification, "prime listings" ARE Products with
 * isPrime=true.  All CRUD operations work directly on the Product collection.
 * Response shapes intentionally mirror the old PrimeProduct API so the frontend
 * requires minimal changes (vendorPrice, vendorMRP, product_id aliases still present).
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import Product from '../models/Product';
import VendorDetails from '../models/VendorDetails';
import { AppError } from '../middlewares/errorHandler';
import logger from '../config/logger';
import { clearCache } from '../middlewares/cache';

// ─── Helper: Shape a Product document into the old listing response ───────────
// Keeps the frontend reading listing.vendorPrice / listing.product_id.name unchanged.
function productToListing(product: any) {
  const doc = typeof product.toObject === 'function' ? product.toObject() : product;
  return {
    _id: doc._id,
    // Emulate the old populated product_id so the frontend reads listing.product_id.name
    product_id: {
      _id: doc._id,
      name: doc.name,
      mainCategory: doc.mainCategory,
      subCategory: doc.subCategory,
      images: doc.images,
      brand_id: doc.brand_id,
      mrp: doc.mrp,
      purchasePrice: doc.purchasePrice,
      sellingPrice: doc.sellingPrice,
      hasVariants: doc.hasVariants || false,
      variants: doc.variants || [],
    },
    vendor_id: doc.primeVendor_id,
    // Aliases the frontend reads as listing.vendorPrice / listing.vendorMRP
    vendorPrice: doc.sellingPrice || 0,
    vendorMRP: doc.mrp || 0,
    purchasePrice: doc.purchasePrice || 0,
    discount: doc.discount || 0,
    stock: doc.stock || 0,
    minOrderQuantity: doc.minOrderQuantity ?? 1,
    maxOrderQuantity: doc.maxOrderQuantity ?? 100,
    isAvailable: doc.isAvailable !== false,
    isActive: doc.isActive !== false,
    deliveryTime: doc.deliveryTime || '3-5 business days',
    deliveryNotes: doc.deliveryNotes,
    vendorDescription: doc.description,
    vendorImages: doc.vendorImages || [],
    ordersCount: doc.ordersCount || 0,
    soldQuantity: doc.soldQuantity || 0,
    views: doc.views || 0,
    inStock: doc.inStock !== false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// Create Prime Product Listing (Admin creates on behalf of vendor, or Prime Vendor creates own)
// After unification: marks an EXISTING Product as prime with vendor-specific fields.
export const createPrimeListing = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const vendor_id = isAdmin && req.body.vendor_id ? req.body.vendor_id : req.user._id;
    const {
      product_id,
      vendorPrice,
      vendorMRP,
      purchasePrice,
      stock,
      minOrderQuantity,
      maxOrderQuantity,
      deliveryTime,
      deliveryNotes,
      vendorDescription,
      vendorImages,
    } = req.body;

    // Validate product exists
    const product = await Product.findById(product_id);
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // A vendor cannot list the same product twice
    if (product.isPrime && product.primeVendor_id?.toString() === vendor_id.toString()) {
      return next(new AppError('You have already listed this product', 400));
    }

    if (Number(vendorPrice) > Number(vendorMRP)) {
      return next(new AppError('Vendor price cannot be greater than MRP', 400));
    }

    const discount = ((Number(vendorMRP) - Number(vendorPrice)) / Number(vendorMRP)) * 100;

    // Merge prime fields directly onto the Product document
    await Product.findByIdAndUpdate(product_id, {
      $set: {
        isPrime: true,
        primeVendor_id: vendor_id,
        sellingPrice: Number(vendorPrice),
        mrp: Number(vendorMRP),
        purchasePrice: Number(purchasePrice) || 0,
        discount,
        stock: Number(stock) || 0,
        minOrderQuantity: Number(minOrderQuantity) || 1,
        maxOrderQuantity: Number(maxOrderQuantity) || 100,
        deliveryTime: deliveryTime || '3-5 business days',
        deliveryNotes,
        ...(vendorDescription ? { description: vendorDescription } : {}),
        vendorImages: vendorImages || [],
        isAvailable: Number(stock) > 0,
        isActive: true,
      },
    });

    const updatedProduct = await Product.findById(product_id);

    // Keep vendor stats in sync
    await VendorDetails.findOneAndUpdate(
      { vendor_id },
      { $inc: { totalPrimeProducts: 1, activePrimeProducts: 1 } }
    );

    logger.info(`[PrimeProduct] Product ${product_id} marked as prime listing by vendor ${vendor_id}`);

    res.status(201).json({
      success: true,
      message: 'Prime product listing created successfully',
      data: { primeListing: productToListing(updatedProduct) },
    });
  } catch (error: any) {
    logger.error('[PrimeProduct] Error creating listing:', error);
    next(error);
  }
};

// Get Vendor's Prime Listings (Admin can filter by vendor_id or get all)
export const getMyPrimeListings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { page = 1, limit = 20, isActive, isAvailable, vendor_id: queryVendorId } = req.query;

    const query: any = { isPrime: true };
    if (isAdmin) {
      if (queryVendorId) query.primeVendor_id = queryVendorId;
    } else {
      query.primeVendor_id = req.user._id;
    }
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isAvailable !== undefined) query.isAvailable = isAvailable === 'true';

    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find(query)
      .populate('brand_id', 'name')
      .populate('primeVendor_id', 'name email shopName')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        listings: products.map(productToListing),
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit),
        },
      },
    });
  } catch (error: any) {
    logger.error('[PrimeProduct] Error fetching listings:', error);
    next(error);
  }
};

// Get Single Prime Listing
export const getPrimeListing = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendor_id = req.user._id;
    const { id } = req.params;

    const product = await Product.findOne({
      _id: id,
      primeVendor_id: vendor_id,
      isPrime: true,
    }).populate('brand_id', 'name');

    if (!product) {
      return next(new AppError('Prime listing not found', 404));
    }

    res.status(200).json({
      success: true,
      data: { listing: productToListing(product) },
    });
  } catch (error: any) {
    logger.error('[PrimeProduct] Error fetching listing:', error);
    next(error);
  }
};

// Update Prime Listing (Admin can update any; vendor can update their own)
// Accepts old field names (vendorPrice, vendorMRP) and maps to Product fields.
export const updatePrimeListing = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const vendor_id = req.user._id;
    const { id } = req.params;
    const updates = req.body;

    const query = isAdmin
      ? { _id: id, isPrime: true }
      : { _id: id, primeVendor_id: vendor_id, isPrime: true };

    const product = await Product.findOne(query);
    if (!product) {
      return next(new AppError('Prime listing not found', 404));
    }

    // Only admins may change purchasePrice
    if (!isAdmin) delete updates.purchasePrice;

    // Map old field names to Product field names
    const productUpdates: any = {};
    if (updates.vendorPrice !== undefined) productUpdates.sellingPrice = Number(updates.vendorPrice);
    if (updates.vendorMRP !== undefined) productUpdates.mrp = Number(updates.vendorMRP);
    if (updates.purchasePrice !== undefined) productUpdates.purchasePrice = Number(updates.purchasePrice);
    if (updates.stock !== undefined) {
      productUpdates.stock = Number(updates.stock);
      productUpdates.isAvailable = Number(updates.stock) > 0;
    }
    if (updates.minOrderQuantity !== undefined) productUpdates.minOrderQuantity = Number(updates.minOrderQuantity);
    if (updates.maxOrderQuantity !== undefined) productUpdates.maxOrderQuantity = Number(updates.maxOrderQuantity);
    if (updates.deliveryTime !== undefined) productUpdates.deliveryTime = updates.deliveryTime;
    if (updates.deliveryNotes !== undefined) productUpdates.deliveryNotes = updates.deliveryNotes;
    if (updates.vendorDescription !== undefined) productUpdates.description = updates.vendorDescription;
    if (updates.vendorImages !== undefined) productUpdates.vendorImages = updates.vendorImages;
    if (updates.isAvailable !== undefined) productUpdates.isAvailable = updates.isAvailable;

    // Validate pricing
    const mrp = productUpdates.mrp ?? product.mrp ?? 0;
    const price = productUpdates.sellingPrice ?? product.sellingPrice ?? 0;
    if (mrp > 0 && price > 0 && price > mrp) {
      return next(new AppError('Vendor price cannot be greater than MRP', 400));
    }
    if (mrp > 0 && price > 0) {
      productUpdates.discount = ((mrp - price) / mrp) * 100;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: productUpdates },
      { new: true }
    );

    clearCache('/products');

    logger.info(`[PrimeProduct] Listing ${id} updated by ${isAdmin ? 'admin' : `vendor ${vendor_id}`}`);

    res.status(200).json({
      success: true,
      message: 'Prime listing updated successfully',
      data: { listing: productToListing(updatedProduct) },
    });
  } catch (error: any) {
    logger.error('[PrimeProduct] Error updating listing:', error);
    next(error);
  }
};

// Toggle Availability (Mark Available/Unavailable)
// Syncs Product.inStock so the "Out of Stock" badge on the catalogue is accurate.
export const toggleAvailability = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendor_id = req.user._id;
    const { id } = req.params;

    const product = await Product.findOne({
      _id: id,
      primeVendor_id: vendor_id,
      isPrime: true,
    });
    if (!product) {
      return next(new AppError('Prime listing not found', 404));
    }

    const newIsAvailable = !(product.isAvailable !== false);

    await Product.findByIdAndUpdate(id, {
      $set: { isAvailable: newIsAvailable, inStock: newIsAvailable },
    });

    // Clear product cache so customers immediately see the updated badge
    clearCache('/products');
    clearCache('/prime-products');

    logger.info(`[PrimeProduct] Listing ${id} availability toggled to ${newIsAvailable}`);

    res.status(200).json({
      success: true,
      message: `Product marked as ${newIsAvailable ? 'available' : 'unavailable'}`,
      data: { isAvailable: newIsAvailable },
    });
  } catch (error: any) {
    logger.error('[PrimeProduct] Error toggling availability:', error);
    next(error);
  }
};

// Delete Prime Listing (Admin can delete any; vendor can delete their own)
// Deletes the Product document itself — a prime listing IS a Product.
export const deletePrimeListing = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const vendor_id = req.user._id;
    const { id } = req.params;

    const query = isAdmin
      ? { _id: id, isPrime: true }
      : { _id: id, primeVendor_id: vendor_id, isPrime: true };

    const product = await Product.findOne(query);
    if (!product) {
      return next(new AppError('Prime listing not found', 404));
    }

    const ownerVendorId = product.primeVendor_id;
    const wasActive = product.isActive;

    await product.deleteOne();

    clearCache('/products');
    clearCache('/prime-products');

    // Keep vendor stats in sync
    await VendorDetails.findOneAndUpdate(
      { vendor_id: ownerVendorId },
      {
        $inc: {
          totalPrimeProducts: -1,
          activePrimeProducts: wasActive ? -1 : 0,
        },
      }
    );

    logger.info(`[PrimeProduct] Listing ${id} deleted by ${isAdmin ? 'admin' : `vendor ${vendor_id}`}`);

    res.status(200).json({
      success: true,
      message: 'Prime listing deleted successfully',
    });
  } catch (error: any) {
    logger.error('[PrimeProduct] Error deleting listing:', error);
    next(error);
  }
};

// Get Prime Vendor Dashboard Stats
export const getPrimeDashboardStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendor_id = req.user._id;
    const Order = (await import('../models/Order')).default;

    const [
      totalProducts,
      activeProducts,
      unavailableProducts,
      vendorDetails,
      pendingOrders,
      completedOrders,
    ] = await Promise.all([
      Product.countDocuments({ primeVendor_id: vendor_id, isPrime: true, isActive: true }),
      Product.countDocuments({ primeVendor_id: vendor_id, isPrime: true, isActive: true, isAvailable: true }),
      Product.countDocuments({ primeVendor_id: vendor_id, isPrime: true, isActive: true, isAvailable: false }),
      VendorDetails.findOne({ vendor_id }),
      Order.countDocuments({ assignedVendorId: vendor_id, isPrime: true, status: 'PENDING' }),
      Order.countDocuments({ assignedVendorId: vendor_id, isPrime: true, status: 'DELIVERED' }),
    ]);

    // Get total Prime orders for this vendor
    const totalOrders = await Order.countDocuments({
      assignedVendorId: vendor_id,
      isPrime: true,
    });

    // Calculate total revenue from completed orders
    const revenueOrders = await Order.find({
      assignedVendorId: vendor_id,
      isPrime: true,
      status: 'DELIVERED',
    }).select('total');

    const totalRevenue = revenueOrders.reduce((sum: number, order: any) => sum + (order.total || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalProducts,
          activeProducts,
          unavailableProducts,
          totalOrders,
          pendingOrders,
          completedOrders,
          totalRevenue,
          rating: vendorDetails?.rating || 0,
        },
      },
    });
  } catch (error: any) {
    logger.error('[PrimeProduct] Error fetching dashboard stats:', error);
    next(error);
  }
};

// Admin: Get all prime listings across all vendors
export const adminGetAllPrimeListings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page = 1, limit = 50, vendor_id, isActive } = req.query;

    const query: any = { isPrime: true };
    if (vendor_id) query.primeVendor_id = vendor_id;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find(query)
      .populate('brand_id', 'name mainCategory subCategory images')
      .populate('primeVendor_id', 'name email shopName vendorType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        listings: products.map(productToListing),
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          itemsPerPage: Number(limit),
        },
      },
    });
  } catch (error: any) {
    logger.error('[PrimeProduct] Admin error fetching all listings:', error);
    next(error);
  }
};

// Prime Vendor Wallet: complete earnings & order breakdown
export const getPrimeWalletStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendor_id = req.user._id;
    const { startDate, endDate } = req.query;
    const Order = (await import('../models/Order')).default;

    // Build date filter
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    const baseQuery: any = {
      assignedVendorId: vendor_id,
      ...dateFilter,
    };

    // All orders (excluding cancelled)
    const allOrders = await Order.find({
      ...baseQuery,
      status: { $nin: ['CANCELLED', 'REJECTED'] },
    })
      .populate('customer_id', 'name email')
      .populate('items.product_id', 'name images')
      .sort({ createdAt: -1 })
      .lean();

    // Vendor earning = totalPurchasePrice (purchase price × qty for each item).
    // This is what Petmaza pays the prime vendor per order — not a % of the customer price.
    let totalRevenue = 0;
    let completedCount = 0;
    let pendingSettlement = 0;

    const orderList = allOrders.map((order: any) => {
      const vendorShare = order.totalPurchasePrice || 0;
      const isDelivered = order.status === 'DELIVERED';
      if (isDelivered) {
        totalRevenue += vendorShare;
        completedCount += 1;
      } else {
        pendingSettlement += vendorShare;
      }

      const customer = order.customer_id as any;
      const productNames = (order.items || [])
        .map((item: any) => item.product_id?.name || 'Product')
        .join(', ');

      return {
        orderId: order.order_id || order._id,
        orderDate: order.createdAt,
        customerName: customer?.name || 'N/A',
        products: productNames,
        status: order.status,
        vendorEarning: isDelivered ? vendorShare : 0,
        pendingAmount: !isDelivered ? vendorShare : 0,
        paymentStatus: order.payment_status || 'N/A',
      };
    });

    // Monthly breakdown
    const monthlyMap: Record<string, { month: string; orders: number; earnings: number }> = {};
    allOrders.forEach((order: any) => {
      if (order.status !== 'DELIVERED') return;
      const d = new Date(order.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      if (!monthlyMap[key]) monthlyMap[key] = { month: label, orders: 0, earnings: 0 };
      monthlyMap[key].orders += 1;
      monthlyMap[key].earnings += order.totalPurchasePrice || 0;
    });

    const monthlyBreakdown = Object.values(monthlyMap).sort((a, b) =>
      a.month > b.month ? 1 : -1
    );

    // Status breakdown
    const statusBreakdown: Record<string, number> = {};
    allOrders.forEach((order: any) => {
      statusBreakdown[order.status] = (statusBreakdown[order.status] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalOrders: allOrders.length,
          completedOrders: completedCount,
          totalEarnings: totalRevenue,
          pendingSettlement,
          platformFee: `0%`,
        },
        statusBreakdown,
        monthlyBreakdown,
        orders: orderList,
      },
    });
  } catch (error: any) {
    logger.error('[PrimeProduct] Error fetching wallet stats:', error);
    next(error);
  }
};
