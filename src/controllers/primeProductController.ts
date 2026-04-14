import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import PrimeProduct from '../models/PrimeProduct';
import Product from '../models/Product';
import VendorDetails from '../models/VendorDetails';
import { AppError } from '../middlewares/errorHandler';
import logger from '../config/logger';
import { clearCache } from '../middlewares/cache';

// Create Prime Product Listing (Prime Vendor only)
export const createPrimeListing = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendor_id = req.user._id;
    const {
      product_id,
      vendorPrice,
      vendorMRP,
      stock,
      minOrderQuantity,
      maxOrderQuantity,
      deliveryTime,
      deliveryNotes,
      vendorDescription,
      vendorImages,
      selectedVariant,
    } = req.body;

    // Validate product exists
    const product = await Product.findById(product_id);
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Check if vendor already listed this product
    const existingListing = await PrimeProduct.findOne({
      vendor_id,
      product_id,
    });
    if (existingListing) {
      return next(new AppError('You have already listed this product', 400));
    }

    // Validate pricing
    if (vendorPrice > vendorMRP) {
      return next(new AppError('Vendor price cannot be greater than MRP', 400));
    }

    // Calculate discount
    const discount = ((vendorMRP - vendorPrice) / vendorMRP) * 100;

    // Create prime listing
    const primeListing = await PrimeProduct.create({
      vendor_id,
      product_id,
      vendorPrice,
      vendorMRP,
      discount,
      stock,
      minOrderQuantity: minOrderQuantity || 1,
      maxOrderQuantity: maxOrderQuantity || 100,
      deliveryTime: deliveryTime || '3-5 business days',
      deliveryNotes,
      vendorDescription,
      vendorImages: vendorImages || [],
      selectedVariant,
      isAvailable: stock > 0,
      isActive: true,
    });

    // Update vendor stats
    await VendorDetails.findOneAndUpdate(
      { vendor_id },
      {
        $inc: { totalPrimeProducts: 1, activePrimeProducts: 1 },
      }
    );

    logger.info(`[PrimeProduct] Listing created by vendor ${vendor_id} for product ${product_id}`);

    res.status(201).json({
      success: true,
      message: 'Prime product listing created successfully',
      data: { primeListing },
    });
  } catch (error: any) {
    logger.error('[PrimeProduct] Error creating listing:', error);
    next(error);
  }
};

// Get Vendor's Prime Listings
export const getMyPrimeListings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendor_id = req.user._id;
    const { page = 1, limit = 20, isActive, isAvailable } = req.query;

    const query: any = { vendor_id };
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isAvailable !== undefined) query.isAvailable = isAvailable === 'true';

    const skip = (Number(page) - 1) * Number(limit);

    const listings = await PrimeProduct.find(query)
      .populate('product_id', 'name mainCategory subCategory images brand_id')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await PrimeProduct.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        listings,
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

    const listing = await PrimeProduct.findOne({ _id: id, vendor_id })
      .populate('product_id', 'name mainCategory subCategory images brand_id mrp sellingPrice');

    if (!listing) {
      return next(new AppError('Prime listing not found', 404));
    }

    res.status(200).json({
      success: true,
      data: { listing },
    });
  } catch (error: any) {
    logger.error('[PrimeProduct] Error fetching listing:', error);
    next(error);
  }
};

// Update Prime Listing (Vendor can update their own listings)
export const updatePrimeListing = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendor_id = req.user._id;
    const { id } = req.params;
    const updates = req.body;

    const listing = await PrimeProduct.findOne({ _id: id, vendor_id });
    if (!listing) {
      return next(new AppError('Prime listing not found', 404));
    }

    // Validate pricing if updating
    if (updates.vendorPrice || updates.vendorMRP) {
      const mrp = updates.vendorMRP || listing.vendorMRP;
      const price = updates.vendorPrice || listing.vendorPrice;
      
      if (price > mrp) {
        return next(new AppError('Vendor price cannot be greater than MRP', 400));
      }
      
      updates.discount = ((mrp - price) / mrp) * 100;
    }

    // Update availability based on stock
    if (updates.stock !== undefined) {
      updates.isAvailable = updates.stock > 0;
    }

    Object.assign(listing, updates);
    await listing.save();

    logger.info(`[PrimeProduct] Listing ${id} updated by vendor ${vendor_id}`);

    res.status(200).json({
      success: true,
      message: 'Prime listing updated successfully',
      data: { listing },
    });
  } catch (error: any) {
    logger.error('[PrimeProduct] Error updating listing:', error);
    next(error);
  }
};

// Toggle Availability (Mark Available/Unavailable)
export const toggleAvailability = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendor_id = req.user._id;
    const { id } = req.params;

    const listing = await PrimeProduct.findOne({ _id: id, vendor_id });
    if (!listing) {
      return next(new AppError('Prime listing not found', 404));
    }

    listing.isAvailable = !listing.isAvailable;
    await listing.save();

    logger.info(`[PrimeProduct] Listing ${id} availability toggled to ${listing.isAvailable}`);

    res.status(200).json({
      success: true,
      message: `Product marked as ${listing.isAvailable ? 'available' : 'unavailable'}`,
      data: { isAvailable: listing.isAvailable },
    });
  } catch (error: any) {
    logger.error('[PrimeProduct] Error toggling availability:', error);
    next(error);
  }
};

// Delete Prime Listing
export const deletePrimeListing = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const vendor_id = req.user._id;
    const { id } = req.params;

    const listing = await PrimeProduct.findOne({ _id: id, vendor_id });
    if (!listing) {
      return next(new AppError('Prime listing not found', 404));
    }

    // Also delete the corresponding Product from the main collection
    // so customers no longer see it
    if (listing.product_id) {
      const product = await Product.findById(listing.product_id);
      if (product && product.isPrime && product.primeVendor_id?.toString() === vendor_id.toString()) {
        await Product.findByIdAndDelete(listing.product_id);
        logger.info(`[PrimeProduct] Also deleted Product ${listing.product_id} from main collection`);
      }
    }

    await listing.deleteOne();

    // Clear ALL product caches so customers immediately stop seeing the deleted product
    clearCache('/products');
    clearCache('/prime-products');

    // Update vendor stats
    await VendorDetails.findOneAndUpdate(
      { vendor_id },
      {
        $inc: {
          totalPrimeProducts: -1,
          activePrimeProducts: listing.isActive ? -1 : 0,
        },
      }
    );

    logger.info(`[PrimeProduct] Listing ${id} deleted by vendor ${vendor_id}`);

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

    const [totalProducts, activeProducts, unavailableProducts, vendorDetails, pendingOrders, completedOrders] =
      await Promise.all([
        PrimeProduct.countDocuments({ vendor_id, isActive: true }),
        PrimeProduct.countDocuments({
          vendor_id,
          isActive: true,
          isAvailable: true,
        }),
        PrimeProduct.countDocuments({
          vendor_id,
          isActive: true,
          isAvailable: false,
        }),
        VendorDetails.findOne({ vendor_id }),
        Order.countDocuments({
          assignedVendorId: vendor_id,
          isPrime: true,
          status: 'PENDING',
        }),
        Order.countDocuments({
          assignedVendorId: vendor_id,
          isPrime: true,
          status: 'DELIVERED',
        }),
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
    
    const totalRevenue = revenueOrders.reduce((sum, order) => sum + order.total, 0);

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
