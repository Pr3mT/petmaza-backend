import { Request, Response, NextFunction } from 'express';
import VendorProductPricing from '../models/VendorProductPricing';
import Product from '../models/Product';
import Order from '../models/Order';
import User from '../models/User';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';

export const getVendorProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vendor = req.user;
    let products;

    // PRIME vendors only see assigned products
    if (vendor.vendorType === 'PRIME') {
      // Get products assigned to this PRIME vendor
      const assignedProducts = await Product.find({ 
        isPrime: true,
        primeVendor_id: vendor._id
        // Removed isActive filter to show all products (available and marked out)
      })
        .populate('brand_id', 'name _id')
        .populate('category_id', 'name _id')
        .sort({ createdAt: -1 });

      // Get or create VendorProductPricing entries
      const productsWithPricing = await Promise.all(
        assignedProducts.map(async (product) => {
          let vendorProduct = await VendorProductPricing.findOne({
            vendor_id: vendor._id,
            product_id: product._id,
          });

          // If no pricing entry exists, create one
          if (!vendorProduct) {
            vendorProduct = await VendorProductPricing.create({
              vendor_id: vendor._id,
              product_id: product._id,
              purchasePercentage: product.purchasePercentage || 60,
              purchasePrice: product.hasVariants && product.variants?.length > 0 
                ? 0 
                : (product.mrp || 0) * ((product.purchasePercentage || 60) / 100),
              availableStock: 0,
              isActive: false,
              variantStock: product.hasVariants && product.variants?.length > 0
                ? product.variants.map((variant: any) => ({
                    weight: variant.weight,
                    unit: variant.unit,
                    displayWeight: variant.displayWeight,
                    availableStock: 0,
                    totalSoldWebsite: 0,
                    totalSoldStore: 0,
                    isActive: false,
                  }))
                : undefined,
            });
          } else if (!vendorProduct.variantStock && product.hasVariants && product.variants?.length > 0) {
            // Initialize variantStock if product has variants but vendor doesn't
            vendorProduct.variantStock = product.variants.map((variant: any) => ({
              weight: variant.weight,
              unit: variant.unit,
              displayWeight: variant.displayWeight,
              availableStock: 0,
              totalSoldWebsite: 0,
              totalSoldStore: 0,
              isActive: false,
            }));
            await vendorProduct.save();
          }

          // Populate product_id with full product data
          await vendorProduct.populate({
            path: 'product_id',
            populate: {
              path: 'brand_id',
              select: 'name _id',
            },
          });

          return vendorProduct;
        })
      );

      return res.status(200).json({
        success: true,
        data: {
          products: productsWithPricing,
        },
      });
    }

    // MY_SHOP vendors only see non-PRIME products (regular products)
    const allProducts = await Product.find({ 
      isPrime: false // Only regular products, not PRIME products
      // Removed isActive filter to show all products (available and marked out)
    })
      .populate('brand_id', 'name _id')
      .populate('category_id', 'name _id')
      .sort({ createdAt: -1 });

    // Check if vendor is MY_SHOP
    const isMyShop = ['WAREHOUSE', 'MY_SHOP'].includes(vendor.vendorType);

    // Get or create VendorProductPricing entries for each product
    const productsWithPricing = await Promise.all(
      allProducts.map(async (product) => {
        let vendorProduct = await VendorProductPricing.findOne({
          vendor_id: vendor._id,
          product_id: product._id,
        });
        
        console.log(`\n🔍 Checking product: ${product.name}`);
        console.log('Found existing VendorProductPricing:', !!vendorProduct);
        if (vendorProduct && vendorProduct.variantStock) {
          console.log('Existing variantStock:', JSON.stringify(vendorProduct.variantStock.map((v: any) => ({ weight: v.weight, unit: v.unit, stock: v.availableStock })), null, 2));
        }

        // If no pricing entry exists, create one
        if (!vendorProduct) {
          console.log('⚠️ No VendorProductPricing found. Creating new one with 0 stock.');
          vendorProduct = await VendorProductPricing.create({
            vendor_id: vendor._id,
            product_id: product._id,
            purchasePercentage: product.purchasePercentage || 60,
            purchasePrice: product.hasVariants && product.variants?.length > 0 
              ? 0 
              : (product.mrp || 0) * ((product.purchasePercentage || 60) / 100),
            availableStock: 0,
            isActive: false, // Vendor needs to mark as available
            variantStock: product.hasVariants && product.variants?.length > 0
              ? product.variants.map((variant: any) => ({
                  weight: variant.weight,
                  unit: variant.unit,
                  displayWeight: variant.displayWeight,
                  availableStock: 0,
                  totalSoldWebsite: 0,
                  totalSoldStore: 0,
                  isActive: false,
                }))
              : undefined,
          });
        } else {
          // Only initialize variantStock if product has variants but vendor pricing doesn't
          if (!vendorProduct.variantStock && product.hasVariants && product.variants?.length > 0) {
            // Initialize variantStock if product has variants but vendor doesn't
            vendorProduct.variantStock = product.variants.map((variant: any) => ({
              weight: variant.weight,
              unit: variant.unit,
              displayWeight: variant.displayWeight,
              availableStock: 0,
              totalSoldWebsite: 0,
              totalSoldStore: 0,
              isActive: variant.isActive,
            }));
            await vendorProduct.save();
          }
        }

        // Populate product_id with full product data
        await vendorProduct.populate({
          path: 'product_id',
          populate: {
            path: 'brand_id',
            select: 'name _id',
          },
        });

        return vendorProduct;
      })
    );

    res.status(200).json({
      success: true,
      data: {
        products: productsWithPricing,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getAvailableProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, search, category } = req.query;

    const query: any = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) {
      query.category_id = category;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find(query)
      .populate('category_id', 'name')
      .populate('brand_id', 'name _id')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    // Get vendor's assigned products with pricing info
    const vendorPricing = await VendorProductPricing.find({ 
      vendor_id: req.user._id,
      isActive: true,
    }).populate('product_id', '_id');

    const vendorProductMap = new Map();
    vendorPricing.forEach(vp => {
      const productId = (vp.product_id as any)?._id?.toString();
      if (productId) {
        vendorProductMap.set(productId, {
          purchasePercentage: vp.purchasePercentage,
          purchasePrice: vp.purchasePrice,
          availableStock: vp.availableStock,
        });
      }
    });

    // Add assignment status to products
    const productsWithAssignmentStatus = products.map(product => {
      const productId = product._id.toString();
      const assignment = vendorProductMap.get(productId);
      
      return {
        ...product.toObject(),
        isAssigned: !!assignment,
        purchasePercentage: assignment?.purchasePercentage || null,
        purchasePrice: assignment?.purchasePrice || null,
        availableStock: assignment?.availableStock || null,
      };
    });

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        products: productsWithAssignmentStatus,
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

// Update stock for assigned product (vendors can only update availableStock)
export const updateVendorProductStock = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // product_id
    const { availableStock, weight, unit, action, reason } = req.body; // action: 'set', 'add', 'remove'; reason: 'sold_offline', 'adjustment'

    if (availableStock === undefined || availableStock < 0) {
      return next(new AppError('Please provide a valid stock quantity', 400));
    }

    // Check if this vendor is MY SHOP (main warehouse)
    const vendor = await User.findById(req.user._id);
    const isMyShop = vendor && ['WAREHOUSE', 'MY_SHOP'].includes(vendor.vendorType);

    if (isMyShop) {
      // For MY_SHOP, find or create VendorProductPricing to store stock
      let vendorProductPricing = await VendorProductPricing.findOne({
        vendor_id: req.user._id,
        product_id: id,
      });

      // If no VendorProductPricing exists, create one
      if (!vendorProductPricing) {
        const product = await Product.findById(id);
        if (!product) {
          return next(new AppError('Product not found', 404));
        }

        vendorProductPricing = await VendorProductPricing.create({
          vendor_id: req.user._id,
          product_id: id,
          purchasePercentage: product.sellingPercentage || 0,
          isActive: true,
          availableStock: 0,
        });
      }

      // Check if this is a variant stock update
      if (weight !== undefined && unit !== undefined) {
        // Initialize variantStock if needed
        if (!vendorProductPricing.variantStock) {
          const product = await Product.findById(id);
          if (product?.hasVariants && product.variants) {
            vendorProductPricing.variantStock = product.variants.map((variant: any) => ({
              weight: variant.weight,
              unit: variant.unit,
              displayWeight: variant.displayWeight,
              isActive: variant.isActive || true,
              availableStock: 0,
            }));
          }
        }

        if (vendorProductPricing.variantStock) {
          // Update specific variant stock
          const variantIndex = vendorProductPricing.variantStock.findIndex(
            (v: any) => v.weight === Number(weight) && v.unit === unit
          );
          
          if (variantIndex === -1) {
            return next(new AppError('Variant not found', 404));
          }
          
          const currentStock = vendorProductPricing.variantStock[variantIndex].availableStock || 0;
          let newStock = Number(availableStock);
          
          // Handle different actions
          if (action === 'add') {
            newStock = currentStock + Number(availableStock);
          } else if (action === 'remove') {
            newStock = Math.max(0, currentStock - Number(availableStock));
            
            // If sold offline, increment totalSoldStore
            if (reason === 'sold_offline') {
              const currentSoldStore = vendorProductPricing.variantStock[variantIndex].totalSoldStore || 0;
              vendorProductPricing.variantStock[variantIndex].totalSoldStore = currentSoldStore + Number(availableStock);
            }
          }
          
          vendorProductPricing.variantStock[variantIndex].availableStock = newStock;
          vendorProductPricing.markModified('variantStock');
        }
      } else {
        // Update single product stock
        const currentStock = vendorProductPricing.availableStock || 0;
        let newStock = Number(availableStock);
        
        // Handle different actions
        if (action === 'add') {
          newStock = currentStock + Number(availableStock);
        } else if (action === 'remove') {
          newStock = Math.max(0, currentStock - Number(availableStock));
          
          // If sold offline, increment totalSoldStore
          if (reason === 'sold_offline') {
            vendorProductPricing.totalSoldStore = (vendorProductPricing.totalSoldStore || 0) + Number(availableStock);
          }
        }
        
        vendorProductPricing.availableStock = newStock;
      }

      await vendorProductPricing.save();

      await vendorProductPricing.populate({
        path: 'product_id',
        populate: {
          path: 'brand_id',
          select: 'name _id',
        },
      });

      res.status(200).json({
        success: true,
        message: 'Stock updated successfully',
        data: {
          product: vendorProductPricing,
        },
      });
    } else {
      // For PRIME vendors, use existing VendorProductPricing
      const vendorProductPricing = await VendorProductPricing.findOne({
        vendor_id: req.user._id,
        product_id: id,
      });

      if (!vendorProductPricing) {
        return next(new AppError('Product not assigned to you', 404));
      }

      // Check if this is a variant stock update
      if (weight !== undefined && unit !== undefined && vendorProductPricing.variantStock) {
        // Update specific variant stock
        const variantIndex = vendorProductPricing.variantStock.findIndex(
          (v: any) => v.weight === Number(weight) && v.unit === unit
        );
        
        if (variantIndex === -1) {
          return next(new AppError('Variant not found', 404));
        }
        
        const currentStock = vendorProductPricing.variantStock[variantIndex].availableStock || 0;
        let newStock = Number(availableStock);
        
        // Handle different actions
        if (action === 'add') {
          newStock = currentStock + Number(availableStock);
        } else if (action === 'remove') {
          newStock = Math.max(0, currentStock - Number(availableStock));
        }
        
        vendorProductPricing.variantStock[variantIndex].availableStock = newStock;
        vendorProductPricing.markModified('variantStock');
      } else {
        // Update single product stock
        const currentStock = vendorProductPricing.availableStock || 0;
        let newStock = Number(availableStock);
        
        // Handle different actions
        if (action === 'add') {
          newStock = currentStock + Number(availableStock);
        } else if (action === 'remove') {
          newStock = Math.max(0, currentStock - Number(availableStock));
        }
        
        vendorProductPricing.availableStock = newStock;
      }

      await vendorProductPricing.save();

      await vendorProductPricing.populate({
        path: 'product_id',
        populate: {
          path: 'brand_id',
          select: 'name _id',
        },
      });

      res.status(200).json({
        success: true,
        message: 'Stock updated successfully',
        data: {
          product: vendorProductPricing,
        },
      });
    }
  } catch (error: any) {
    next(error);
  }
};

// Update product availability status (Available/Out of Stock)
export const updateVendorProductStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // product_id
    const { isActive, weight, unit } = req.body;

    if (typeof isActive !== 'boolean') {
      return next(new AppError('Please provide a valid status (true/false)', 400));
    }

    // Check if this vendor is MY SHOP (main warehouse)
    const vendor = await User.findById(req.user._id);
    const isMyShop = vendor && ['WAREHOUSE', 'MY_SHOP'].includes(vendor.vendorType);

    if (isMyShop) {
      // For MY SHOP, directly update the product's variant isActive status
      const product = await Product.findById(id);
      
      if (!product) {
        return next(new AppError('Product not found', 404));
      }

      // Check if this is a variant product
      if (weight !== undefined && unit !== undefined && product.hasVariants && product.variants) {
        // Update specific variant status in the product
        const variantIndex = product.variants.findIndex(
          (v: any) => v.weight === Number(weight) && v.unit === unit
        );
        
        if (variantIndex === -1) {
          return next(new AppError('Variant not found', 404));
        }
        
        product.variants[variantIndex].isActive = isActive;
        product.markModified('variants');
        await product.save();
      } else {
        // Update product-level isActive status
        console.log(`📝 Updating product ${product._id} isActive from ${product.isActive} to ${isActive}`);
        product.isActive = isActive;
        await product.save();
        console.log(`✅ Product saved. New isActive: ${product.isActive}`);
      }

      await product.populate('brand_id', 'name _id');
      await product.populate('category_id', 'name _id');

      console.log(`📤 Returning updated product. isActive: ${product.isActive}`);

      res.status(200).json({
        success: true,
        message: `Product marked as ${isActive ? 'Available' : 'Out of Stock'}`,
        data: {
          product,
        },
      });
    } else {
      // For other vendors, use VendorProductPricing (existing logic)
      const vendorProductPricing = await VendorProductPricing.findOne({
        vendor_id: req.user._id,
        product_id: id,
      });

      if (!vendorProductPricing) {
        return next(new AppError('Product not assigned to you', 404));
      }

      // Check if this is a variant product
      if (weight !== undefined && unit !== undefined && vendorProductPricing.variantStock) {
        // Update specific variant status
        const variantIndex = vendorProductPricing.variantStock.findIndex(
          (v: any) => v.weight === Number(weight) && v.unit === unit
        );
        
        if (variantIndex === -1) {
          return next(new AppError('Variant not found', 404));
        }
        
        vendorProductPricing.variantStock[variantIndex].isActive = isActive;
        vendorProductPricing.markModified('variantStock');
      } else {
        // Update legacy single-weight product status
        vendorProductPricing.isActive = isActive;
      }

      await vendorProductPricing.save();

      await vendorProductPricing.populate({
        path: 'product_id',
        populate: {
          path: 'brand_id',
          select: 'name _id',
        },
      });

      res.status(200).json({
        success: true,
        message: `Product marked as ${isActive ? 'Available' : 'Out of Stock'}`,
        data: {
          product: vendorProductPricing,
        },
      });
    }
  } catch (error: any) {
    next(error);
  }
};

export const getVendorStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vendorId = req.user._id;

    // Order statistics
    const totalOrders = await Order.countDocuments({ assignedVendorId: vendorId });
    const pendingOrders = await Order.countDocuments({
      assignedVendorId: vendorId,
      status: { $in: ['ASSIGNED', 'PACKED'] },
    });
    const completedOrders = await Order.countDocuments({
      assignedVendorId: vendorId,
      status: 'DELIVERED',
    });
    const inProgressOrders = await Order.countDocuments({
      assignedVendorId: vendorId,
      status: { $in: ['PACKED', 'PICKED_UP', 'IN_TRANSIT'] },
    });

    // Product statistics
    const uniqueProducts = await VendorProductPricing.distinct('product_id', { vendor_id: vendorId, isActive: true });

    // Sales analytics - Calculate vendor revenue from delivered orders
    const deliveredOrders = await Order.find({
      assignedVendorId: vendorId,
      status: 'DELIVERED',
      payment_status: 'Paid',
    });

    let totalSales = 0;
    let totalProfit = 0;
    deliveredOrders.forEach(order => {
      order.items.forEach(item => {
        // Vendor gets the purchaseSubtotal (their selling price to platform)
        totalSales += item.purchaseSubtotal || 0;
      });
    });

    // Time-series data (last 7 days, 4 weeks, 12 months)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Daily sales (last 7 days)
    const dailySales = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      const dayOrders = deliveredOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= startOfDay && orderDate <= endOfDay;
      });

      let daySales = 0;
      dayOrders.forEach(order => {
        order.items.forEach(item => {
          daySales += item.purchaseSubtotal || 0;
        });
      });

      dailySales.push({
        date: startOfDay.toISOString().split('T')[0],
        sales: daySales,
      });
    }

    // Weekly sales (last 4 weeks)
    const weeklySales = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(fourWeeksAgo.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      const weekOrders = deliveredOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= weekStart && orderDate < weekEnd;
      });

      let weekSales = 0;
      weekOrders.forEach(order => {
        order.items.forEach(item => {
          weekSales += item.purchaseSubtotal || 0;
        });
      });

      weeklySales.push({
        week: `Week ${4 - i}`,
        sales: weekSales,
      });
    }

    // Monthly sales (last 12 months)
    const monthlySales = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(twelveMonthsAgo);
      monthStart.setMonth(monthStart.getMonth() + i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const monthOrders = deliveredOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= monthStart && orderDate < monthEnd;
      });

      let monthSales = 0;
      monthOrders.forEach(order => {
        order.items.forEach(item => {
          monthSales += item.purchaseSubtotal || 0;
        });
      });

      monthlySales.push({
        month: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }),
        sales: monthSales,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          completed: completedOrders,
          inProgress: inProgressOrders,
        },
        products: {
          unique: uniqueProducts.length,
        },
        sales: {
          total: totalSales,
          daily: dailySales,
          weekly: weeklySales,
          monthly: monthlySales,
        },
      },
    });
  } catch (error: any) {
    next(error);
  }
};

