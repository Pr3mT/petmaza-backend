import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import Product from '../models/Product';
import Order from '../models/Order';
import Transaction from '../models/Transaction';
import ShippingSettings from '../models/ShippingSettings';
import { VendorProductPricingService } from '../services/VendorProductPricingService';
import { ShippingService } from '../services/ShippingService';
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

export const getUserById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    console.log('🔍 getUserById called with id:', id);

    const user = await User.findById(id).select('-password');
    console.log('📦 User found:', user ? 'Yes' : 'No');

    if (!user) {
      console.log('❌ User not found for id:', id);
      return next(new AppError('User not found', 404));
    }

    console.log('✅ Returning user:', user._id);
    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error: any) {
    console.error('❌ Error in getUserById:', error.message);
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

    // Get all vendors (PRIME, MY_SHOP, WAREHOUSE_FULFILLER)
    const vendors = await User.find({
      role: 'vendor',
      vendorType: { $in: ['PRIME', 'MY_SHOP', 'WAREHOUSE_FULFILLER'] }
    }).select('name email vendorType isActive');

    // Get all orders fulfilled by vendors (not PENDING status)
    const orderFilter = {
      ...dateFilter,
      status: { $nin: ['PENDING', 'PENDING_BROADCAST', 'CANCELLED', 'REJECTED'] },
      assignedVendorId: { $exists: true, $ne: null }
    };

    const orders = await Order.find(orderFilter)
      .populate('assignedVendorId', 'name email vendorType')
      .populate('customer_id', 'name email')
      .sort({ createdAt: -1 });

    // Calculate stats by vendor type
    const vendorTypeStats: any = {};
    const vendorStats: any = {};

    // Initialize vendor stats
    vendors.forEach(vendor => {
      const vendorId = vendor._id.toString();
      vendorStats[vendorId] = {
        _id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        vendorType: vendor.vendorType,
        isActive: vendor.isActive,
        totalOrders: 0,
        totalRevenue: 0,
        platformProfit: 0,
      };

      // Initialize vendor type stats
      if (!vendorTypeStats[vendor.vendorType]) {
        vendorTypeStats[vendor.vendorType] = {
          vendorType: vendor.vendorType,
          totalVendors: 0,
          totalOrders: 0,
          totalRevenue: 0,
          totalProfit: 0,
        };
      }
      vendorTypeStats[vendor.vendorType].totalVendors += 1;
    });

    // Calculate revenue and profit from orders
    orders.forEach(order => {
      const vendor = order.assignedVendorId as any;
      if (!vendor || !vendor._id) return;

      const vendorId = vendor._id.toString();
      const vendorType = vendor.vendorType;
      const orderTotal = order.total || 0;

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
      }

      // Update vendor type stats
      if (vendorTypeStats[vendorType]) {
        vendorTypeStats[vendorType].totalOrders += 1;
        vendorTypeStats[vendorType].totalRevenue += orderTotal;
        vendorTypeStats[vendorType].totalProfit += platformProfit;
      }
    });

    // Convert objects to arrays
    const byVendorType = Object.values(vendorTypeStats);
    const vendorList = Object.values(vendorStats).filter((v: any) => v.totalOrders > 0); // Only show vendors with orders

    // Calculate summary
    const summary = {
      totalVendors: vendors.length,
      totalOrders: orders.length,
      totalRevenue: byVendorType.reduce((sum: number, item: any) => sum + item.totalRevenue, 0),
      totalProfit: byVendorType.reduce((sum: number, item: any) => sum + item.totalProfit, 0),
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        byVendorType,
        vendors: vendorList,
      },
    });
  } catch (error: any) {
    console.error('[getVendorBilling] Error:', error);
    next(error);
  }
};