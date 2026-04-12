import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import Product from '../models/Product';
import Order from '../models/Order';
import Transaction from '../models/Transaction';
import ShippingSettings from '../models/ShippingSettings';
import Settlement from '../models/Settlement';
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

    // Fetch all delivered orders assigned to a vendor
    const orderFilter: any = {
      assignedVendorId: { $exists: true, $ne: null },
      status: { $nin: ['CANCELLED', 'REJECTED', 'PENDING'] },
    };
    if (vendorId) orderFilter.assignedVendorId = vendorId;

    const orders = await Order.find(orderFilter)
      .populate('assignedVendorId', 'name email vendorType')
      .populate('customer_id', 'name email')
      .populate('items.product_id', 'name images')
      .populate('items.primeProduct_id', 'name images')
      .sort({ createdAt: -1 })
      .lean();

    // Group by vendor + week key
    const groupMap: Record<string, any> = {};

    for (const order of orders) {
      const vendor = order.assignedVendorId as any;
      if (!vendor) continue;

      const weekInfo = getWeekRange(new Date(order.createdAt as any));
      const weekKey = `${vendor._id.toString()}_${weekInfo.start.toISOString().slice(0, 10)}`;

      if (!groupMap[weekKey]) {
        // Map vendor type to display label
        const typeLabel =
          vendor.vendorType === 'PRIME'
            ? 'Prime Vendor'
            : vendor.vendorType === 'MY_SHOP'
            ? 'My Shop'
            : vendor.vendorType === 'WAREHOUSE_FULFILLER'
            ? 'Fulfiller'
            : vendor.vendorType;

        groupMap[weekKey] = {
          id: weekKey,
          weekStart: weekInfo.start.toISOString(),
          weekEnd: weekInfo.end.toISOString(),
          weekLabel: weekInfo.label,
          vendorId: vendor._id,
          vendorName: vendor.name,
          vendorEmail: vendor.email,
          vendorType: typeLabel,
          totalAmount: 0,
          paidAt: null,
          status: 'Pending', // default; update logic can change to 'Paid'
          orders: [],
        };
      }

      const entry = groupMap[weekKey];
      entry.totalAmount += order.total || 0;
      entry.orders.push({
        orderId: order.order_id || order._id,
        orderDate: order.createdAt,
        orderStatus: order.status,
        items: (order.items || []).map((item: any) => {
          const product = item.product_id || item.primeProduct_id;
          // Order model uses sellingPrice / subtotal (not price / total)
          const unitPrice = item.sellingPrice ?? item.price ?? 0;
          const qty = item.quantity || 1;
          const lineTotal = item.subtotal ?? item.purchaseSubtotal ?? (qty * unitPrice);
          return {
            productId: product?._id ? String(product._id) : 'N/A',
            productName: product?.name || 'Unknown Product',
            quantity: qty,
            price: unitPrice,
            total: lineTotal,
          };
        }),
        grandTotal: order.total || 0,
      });
    }

    let invoices = Object.values(groupMap);

    // Load all settlement records for the vendors in this result set
    const vendorIds = [...new Set(invoices.map((inv) => inv.vendorId.toString()))];
    const settlements = await Settlement.find({ vendorId: { $in: vendorIds } }).lean();
    console.log(`[getVendorWeeklyBilling] Found ${settlements.length} settlement(s) for ${vendorIds.length} vendor(s)`);

    // Build lookup map: "vendorId_weekStart(YYYY-MM-DD)" -> settlement
    const settlementMap: Record<string, any> = {};
    for (const s of settlements) {
      const key = `${s.vendorId.toString()}_${new Date(s.weekStart).toISOString().slice(0, 10)}`;
      settlementMap[key] = s;
    }

    // Merge settlement status into each invoice group
    for (const inv of invoices) {
      const key = `${inv.vendorId.toString()}_${inv.weekStart.slice(0, 10)}`;
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
    console.error('[getVendorWeeklyBilling] Error:', error);
    next(error);
  }
};

/**
 * Mark a weekly invoice entry as Paid
 */
export const markWeeklyInvoicePaid = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { weekStart, vendorId } = req.body;

    if (!weekStart || !vendorId) {
      return res.status(400).json({ success: false, message: 'weekStart and vendorId are required' });
    }

    const paidAt = new Date();
    const weekStartDate = new Date(weekStart);

    // Find existing settlement or create new one — avoids $setOnInsert path-conflict errors
    const existing = await Settlement.findOne({ vendorId, weekStart: weekStartDate });

    if (existing) {
      existing.status = 'paid';
      existing.processedAt = paidAt;
      await existing.save();
    } else {
      await Settlement.create({
        vendorId,
        weekStart: weekStartDate,
        status: 'paid',
        processedAt: paidAt,
        totalDue: 0,
        orders: [],
      });
    }

    console.log(`[markWeeklyInvoicePaid] Saved: vendorId=${vendorId} weekStart=${weekStartDate.toISOString()}`);
    res.status(200).json({ success: true, message: 'Invoice marked as paid', paidAt });
  } catch (error: any) {
    console.error('[markWeeklyInvoicePaid] Error:', error.message);
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

    console.log('[getVendorBilling] Total vendors found:', vendors.length);
    console.log('[getVendorBilling] Vendor types:', vendors.map(v => v.vendorType));

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
      .populate('customer_id', 'name email')
      .populate('items.product_id', 'name category brand')
      .populate('items.primeProduct_id', 'name brand')
      .sort({ createdAt: -1 })
      .lean();

    console.log('[getVendorBilling] Total orders found:', orders.length);
    console.log('[getVendorBilling] Order filter:', JSON.stringify(orderFilter));
    if (orders.length > 0) {
      console.log('[getVendorBilling] First order status:', orders[0].status);
      console.log('[getVendorBilling] First order has assignedVendorId:', !!orders[0].assignedVendorId);
    } else {
      // Debug: Check what orders exist in total
      const totalOrders = await Order.countDocuments(dateFilter);
      const ordersWithVendor = await Order.countDocuments({ 
        ...dateFilter, 
        assignedVendorId: { $exists: true, $ne: null } 
      });
      console.log('[getVendorBilling] DEBUG - Total orders in DB:', totalOrders);
      console.log('[getVendorBilling] DEBUG - Orders with assignedVendorId:', ordersWithVendor);
      
      // Check status distribution
      const statusCounts = await Order.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      console.log('[getVendorBilling] DEBUG - Order status distribution:', statusCounts);
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
        orderId: order.order_id || order._id,
        orderDate: order.createdAt,
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
    const byVendorType = Object.values(vendorTypeStats);
    const vendorList = Object.values(vendorStats); // Show all vendors, not just those with orders

    // Calculate summary
    const summary = {
      totalVendors: vendors.length,
      totalOrders: orders.length,
      totalRevenue: byVendorType.reduce((sum: number, item: any) => sum + item.totalRevenue, 0),
      totalProfit: byVendorType.reduce((sum: number, item: any) => sum + item.totalProfit, 0),
      pendingSettlement: byVendorType.reduce((sum: number, item: any) => sum + item.totalRevenue - item.totalProfit, 0),
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
    console.error('[getVendorBilling] Error:', error);
    next(error);
  }
};