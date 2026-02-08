import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import Product from '../models/Product';
import Order from '../models/Order';
import Transaction from '../models/Transaction';
import { VendorProductPricingService } from '../services/VendorProductPricingService';
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

    const users = await User.find(query)
      .select('-password')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

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

export const approveVendor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    const VendorDetails = (await import('../models/VendorDetails')).default;

    // Update user
    const user = await User.findByIdAndUpdate(
      id,
      { isApproved },
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
    // User counts
    const vendorCount = await User.countDocuments({ role: 'vendor' });
    const customerCount = await User.countDocuments({ role: 'customer' });

    // Product and category counts
    const productCount = await Product.countDocuments();
    const categoryCount = await Product.distinct('category_id').then(ids => ids.length);

    // Order statistics
    const totalOrders = await Order.countDocuments();
    const paidOrders = await Order.countDocuments({ payment_status: 'Paid' });
    const pendingOrders = await Order.countDocuments({ payment_status: 'Pending' });
    const deliveredOrders = await Order.countDocuments({ status: 'DELIVERED' });
    const acceptedOrders = await Order.countDocuments({ status: { $nin: ['PENDING', 'CANCELLED'] } });
    const cancelledOrders = await Order.countDocuments({ status: 'CANCELLED' });

    // Revenue calculation from paid orders
    const paidOrdersData = await Order.find({ payment_status: 'Paid' });
    const totalRevenue = paidOrdersData.reduce((sum, order) => sum + (order.total || 0), 0);
    const totalProfit = paidOrdersData.reduce((sum, order) => sum + (order.totalProfit || 0), 0);
    const totalCost = paidOrdersData.reduce((sum, order) => sum + (order.totalPurchasePrice || 0), 0);
    
    // Revenue by order type
    const normalOrdersRevenue = paidOrdersData
      .filter(order => order.orderType === 'NORMAL')
      .reduce((sum, order) => sum + (order.total || 0), 0);
    
    const primeOrdersRevenue = paidOrdersData
      .filter(order => order.orderType === 'PRIME')
      .reduce((sum, order) => sum + (order.total || 0), 0);
    
    const normalOrdersProfit = paidOrdersData
      .filter(order => order.orderType === 'NORMAL')
      .reduce((sum, order) => sum + (order.totalProfit || 0), 0);
    
    const primeOrdersProfit = paidOrdersData
      .filter(order => order.orderType === 'PRIME')
      .reduce((sum, order) => sum + (order.totalProfit || 0), 0);

    // Recent orders
    const recentOrders = await Order.find()
      .populate('customer_id', 'name email')
      .populate('assignedVendorId', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        users: {
          vendors: vendorCount,
          customers: customerCount,
        },
        products: {
          total: productCount,
          categories: categoryCount,
        },
        orders: {
          total: totalOrders,
          paid: paidOrders,
          pending: pendingOrders,
          delivered: deliveredOrders,
          accepted: acceptedOrders,
          cancelled: cancelledOrders,
        },
        revenue: {
          total: totalRevenue,
          totalProfit: totalProfit,
          totalCost: totalCost,
          normalOrders: normalOrdersRevenue,
          primeOrders: primeOrdersRevenue,
          normalOrdersProfit: normalOrdersProfit,
          primeOrdersProfit: primeOrdersProfit,
          profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
          averageOrderValue: paidOrders > 0 ? totalRevenue / paidOrders : 0,
        },
        recentOrders,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getAllOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, orderType, page = 1, limit = 20 } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (orderType) query.orderType = orderType;

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await Order.find(query)
      .populate('customer_id', 'name email')
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
          _id: v._id,
          displayWeight: v.displayWeight,
          sellingPrice: v.sellingPrice
        }))
      }
    });
  } catch (error: any) {
    next(error);
  }
};