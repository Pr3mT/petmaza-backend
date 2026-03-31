import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import Coupon from '../models/Coupon';
import Order from '../models/Order';
import Brand from '../models/Brand';
import User from '../models/User';
import logger from '../config/logger';

/**
 * Get all coupons (Admin only)
 */
export const getAllCoupons = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let filter: any = {};

    // Filter coupons based on user role (for vendors in read-only mode)
    const userRole = req.user?.role;
    const userId = req.user?._id;

    if (userRole === 'vendor') {
      // Only show coupons specifically assigned to this vendor
      filter = {
        applicableVendors: userId
      };
    }

    const coupons = await Coupon.find(filter)
      .populate('brands', 'name')
      .populate('createdBy', 'name email')
      .populate('applicableVendors', 'name email vendorType')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      data: { coupons },
    });
  } catch (error: any) {
    next(new AppError(error.message, 500));
  }
};

/**
 * Get active coupons (Public - for customers to see available coupons)
 */
export const getActiveCoupons = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();

    const coupons = await Coupon.find({
      isActive: true,
      validFrom: { $lte: now },
      validTo: { $gte: now },
    })
      .populate('brands', 'name')
      .select('-usedBy') // Don't expose usage data
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      data: { coupons },
    });
  } catch (error: any) {
    next(new AppError(error.message, 500));
  }
};

/**
 * Create a new coupon (Admin only)
 */
export const createCoupon = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderValue,
      maxDiscount,
      validFrom,
      validTo,
      usageLimit,
      usagePerUser,
      isFirstTimeOnly,
      applicableProductType,
      applicableVendorTypes,
      applicableVendors,
      applicableFor,
      brands,
      categories,
    } = req.body;

    // Validate coupon code uniqueness
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return next(new AppError('Coupon code already exists', 400));
    }

    // Validate discount value
    if (discountType === 'PERCENTAGE' && (discountValue <= 0 || discountValue > 100)) {
      return next(new AppError('Percentage discount must be between 0 and 100', 400));
    }

    if (discountType === 'FLAT' && discountValue <= 0) {
      return next(new AppError('Flat discount must be greater than 0', 400));
    }

    // Validate dates
    if (new Date(validFrom) >= new Date(validTo)) {
      return next(new AppError('Valid From date must be before Valid To date', 400));
    }

    // Validate brand IDs if brand-specific
    if (applicableFor === 'SPECIFIC_BRANDS' && brands && brands.length > 0) {
      const validBrands = await Brand.find({ _id: { $in: brands } });
      if (validBrands.length !== brands.length) {
        return next(new AppError('One or more brand IDs are invalid', 400));
      }
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue,
      minOrderValue: minOrderValue || 0,
      maxDiscount: maxDiscount || null,
      validFrom,
      validTo,
      usageLimit: usageLimit || null,
      usagePerUser: usagePerUser || 1,
      isFirstTimeOnly: isFirstTimeOnly || false,
      applicableProductType: applicableProductType || 'ALL',
      applicableVendorTypes: applicableVendorTypes || [],
      applicableVendors: applicableVendors || [],
      applicableFor: applicableFor || 'ALL',
      brands: applicableFor === 'SPECIFIC_BRANDS' ? brands : [],
      categories: applicableFor === 'SPECIFIC_CATEGORIES' ? categories : [],
      createdBy: req.user._id,
    });

    logger.info(`[Coupon] New coupon created: ${coupon.code} by admin ${req.user._id}`);

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      data: { coupon },
    });
  } catch (error: any) {
    next(new AppError(error.message, 500));
  }
};

/**
 * Update coupon (Admin only)
 */
export const updateCoupon = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return next(new AppError('Coupon not found', 404));
    }

    // If updating code, check uniqueness
    if (updates.code && updates.code.toUpperCase() !== coupon.code) {
      const existingCoupon = await Coupon.findOne({ code: updates.code.toUpperCase() });
      if (existingCoupon) {
        return next(new AppError('Coupon code already exists', 400));
      }
      updates.code = updates.code.toUpperCase();
    }

    // Validate discount value if being updated
    if (updates.discountType === 'PERCENTAGE' && updates.discountValue) {
      if (updates.discountValue <= 0 || updates.discountValue > 100) {
        return next(new AppError('Percentage discount must be between 0 and 100', 400));
      }
    }

    if (updates.discountType === 'FLAT' && updates.discountValue) {
      if (updates.discountValue <= 0) {
        return next(new AppError('Flat discount must be greater than 0', 400));
      }
    }

    // Validate dates if being updated
    const validFrom = updates.validFrom || coupon.validFrom;
    const validTo = updates.validTo || coupon.validTo;
    if (new Date(validFrom) >= new Date(validTo)) {
      return next(new AppError('Valid From date must be before Valid To date', 400));
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).populate('brands', 'name');

    logger.info(`[Coupon] Coupon updated: ${updatedCoupon!.code} by admin ${req.user._id}`);

    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      data: { coupon: updatedCoupon },
    });
  } catch (error: any) {
    next(new AppError(error.message, 500));
  }
};

/**
 * Delete coupon (Admin only)
 */
export const deleteCoupon = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return next(new AppError('Coupon not found', 404));
    }

    await Coupon.findByIdAndDelete(id);

    logger.info(`[Coupon] Coupon deleted: ${coupon.code} by admin ${req.user._id}`);

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error: any) {
    next(new AppError(error.message, 500));
  }
};

/**
 * Toggle coupon active status (Admin only)
 */
export const toggleCouponStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return next(new AppError('Coupon not found', 404));
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    logger.info(`[Coupon] Coupon ${coupon.isActive ? 'activated' : 'deactivated'}: ${coupon.code}`);

    res.status(200).json({
      success: true,
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { coupon },
    });
  } catch (error: any) {
    next(new AppError(error.message, 500));
  }
};

/**
 * Validate and apply coupon (Customer)
 */
export const validateCoupon = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code, orderValue, items, products } = req.body;
    const userId = req.user._id;

    if (!code || !orderValue) {
      return next(new AppError('Coupon code and order value are required', 400));
    }

    // Accept both 'items' and 'products' for compatibility
    const cartItems = items || products || [];

    // Find coupon
    const coupon = await Coupon.findOne({ code: code.toUpperCase() }).populate('brands', 'name');

    if (!coupon) {
      return next(new AppError('Invalid coupon code', 404));
    }

    // Check if active
    if (!coupon.isActive) {
      return next(new AppError('This coupon is no longer active', 400));
    }

    // Check date validity
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validTo) {
      return next(new AppError('This coupon has expired or is not yet valid', 400));
    }

    // Check minimum order value
    if (coupon.minOrderValue && orderValue < coupon.minOrderValue) {
      return next(
        new AppError(
          `Minimum order value of ₹${coupon.minOrderValue} required to use this coupon`,
          400
        )
      );
    }

    // Check if first-time only
    if (coupon.isFirstTimeOnly) {
      const previousOrders = await Order.countDocuments({
        customer_id: userId,
        status: { $in: ['DELIVERED', 'ACCEPTED', 'PACKED', 'PICKED_UP', 'IN_TRANSIT'] },
      });

      if (previousOrders > 0) {
        return next(new AppError('This coupon is only valid for first-time customers', 400));
      }
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return next(new AppError('This coupon has reached its usage limit', 400));
    }

    // Check per-user usage limit
    const userUsage = coupon.usedBy.find((u) => u.user_id.toString() === userId.toString());
    if (userUsage && coupon.usagePerUser && userUsage.usageCount >= coupon.usagePerUser) {
      return next(new AppError('You have already used this coupon the maximum number of times', 400));
    }

    // Check product type applicability (Prime vs Fulfiller/MyShop products)
    if (coupon.applicableProductType && coupon.applicableProductType !== 'ALL') {
      // Get prime and fulfiller products from cart
      const hasPrimeProducts = cartItems.some((item: any) => 
        item.isPrime || item.product?.isPrime
      );
      const hasFullfillerProducts = cartItems.some((item: any) => 
        !item.isPrime && !item.product?.isPrime
      );
      
      // Check if cart has mixed products
      if (hasPrimeProducts && hasFullfillerProducts) {
        return next(
          new AppError(
            'This coupon code is not valid because your cart contains both Prime and MyShop products. Prime products have different coupon codes. Please use separate coupons or place separate orders.',
            400
          )
        );
      }
      
      // Check if coupon matches cart product type
      if (coupon.applicableProductType === 'PRIME' && !hasPrimeProducts) {
        return next(
          new AppError('This coupon is only valid for Prime vendor products', 400)
        );
      }
      
      if (coupon.applicableProductType === 'FULFILLER' && hasPrimeProducts) {
        return next(
          new AppError('This coupon is only valid for MyShop/Fulfiller products. Prime products have separate coupon codes.', 400)
        );
      }
    }

    // Check brand/category applicability
    if (coupon.applicableFor === 'SPECIFIC_BRANDS' && coupon.brands && coupon.brands.length > 0) {
      const applicableBrandIds = coupon.brands.map((b: any) => b._id.toString());

      // Check if cart items contain products from applicable brands
      const hasApplicableBrand = cartItems.some((item: any) => {
        const brandId = item.brandId || item.product?.brand_id?._id?.toString() || item.product?.brand_id?.toString();
        return brandId && applicableBrandIds.includes(brandId);
      });

      if (!hasApplicableBrand) {
        const brandNames = coupon.brands.map((b: any) => b.name).join(', ');
        return next(
          new AppError(`This coupon is only applicable for brands: ${brandNames}`, 400)
        );
      }
    }

    if (coupon.applicableFor === 'SPECIFIC_CATEGORIES' && coupon.categories && coupon.categories.length > 0) {
      const hasApplicableCategory = cartItems.some((item: any) => {
        const subCategory = item.subcategory || item.product?.subCategory || item.product?.subcategory;
        return subCategory && coupon.categories!.includes(subCategory);
      });

      if (!hasApplicableCategory) {
        return next(
          new AppError(`This coupon is only applicable for categories: ${coupon.categories.join(', ')}`, 400)
        );
      }
    }

    // Calculate discount
    let discountAmount = 0;

    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = (orderValue * coupon.discountValue) / 100;

      // Apply max discount cap if set
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else {
      // FLAT discount
      discountAmount = coupon.discountValue;
    }

    // Ensure discount doesn't exceed order value
    if (discountAmount > orderValue) {
      discountAmount = orderValue;
    }

    const finalAmount = orderValue - discountAmount;

    logger.info(`[Coupon] Coupon ${coupon.code} validated for user ${userId}: ₹${discountAmount} off`);

    res.status(200).json({
      success: true,
      message: 'Coupon applied successfully',
      data: {
        coupon: {
          code: coupon.code,
          description: coupon.description,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
        },
        discountAmount,
        originalAmount: orderValue,
        finalAmount,
      },
    });
  } catch (error: any) {
    logger.error(`[Coupon] Validation error: ${error.message}`, { error: error.stack });
    next(new AppError(error.message, 500));
  }
};

/**
 * Record coupon usage (Called internally after order creation)
 */
export const recordCouponUsage = async (couponCode: string, userId: string) => {
  try {
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
    if (!coupon) return;

    // Increment total usage count
    coupon.usedCount += 1;

    // Update user-specific usage
    const userUsageIndex = coupon.usedBy.findIndex((u) => u.user_id.toString() === userId.toString());

    if (userUsageIndex >= 0) {
      coupon.usedBy[userUsageIndex].usageCount += 1;
      coupon.usedBy[userUsageIndex].lastUsedAt = new Date();
    } else {
      coupon.usedBy.push({
        user_id: userId as any,
        usageCount: 1,
        lastUsedAt: new Date(),
      });
    }

    await coupon.save();

    logger.info(`[Coupon] Usage recorded: ${couponCode} by user ${userId}`);
  } catch (error: any) {
    logger.error(`[Coupon] Error recording usage: ${error.message}`);
  }
};

/**
 * Get vendors by type (for coupon creation dropdown)
 */
export const getVendorsByType = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type } = req.query;

    // Base filter - get all users with vendor role (case-insensitive)
    const filter: any = { 
      role: { $in: ['vendor', 'VENDOR', 'Vendor'] }
    };

    // Only filter by vendorType if it's FULFILLER
    if (type === 'FULFILLER') {
      filter.vendorType = { $in: ['MY_SHOP', 'WAREHOUSE_FULFILLER', 'my_shop', 'warehouse_fulfiller'] };
    }
    // For PRIME or no type, just get all vendors

    const vendors = await User.find(filter)
      .select('_id name email vendorType isApproved role')
      .sort('name');

    logger.info(`[Coupon] Found ${vendors.length} vendors for type: ${type}. Vendors: ${vendors.map(v => `${v.name} (role: ${v.role})`).join(', ')}`);

    res.status(200).json({
      success: true,
      data: { vendors },
    });
  } catch (error: any) {
    logger.error(`[Coupon] Error fetching vendors: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};
