import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import User from '../models/User';
import Product from '../models/Product';
import VendorProductPricing from '../models/VendorProductPricing';
import Order from '../models/Order';
import Wallet from '../models/Wallet';
import { SalesService } from '../services/SalesService';

/**
 * Get warehouse vendor (WAREHOUSE type)
 */
export const getWarehouse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const warehouse = await User.findOne({
      role: 'vendor',
      vendorType: { $in: ['WAREHOUSE', 'MY_SHOP'] },
      isApproved: true,
    });

    if (!warehouse) {
      return next(new AppError('Warehouse not found', 404));
    }

    res.status(200).json({
      success: true,
      data: { warehouse },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get warehouse inventory
 */
export const getWarehouseInventory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const warehouse = await User.findOne({
      role: 'vendor',
      vendorType: { $in: ['WAREHOUSE', 'MY_SHOP'] },
      isApproved: true,
    });

    if (!warehouse) {
      return next(new AppError('Warehouse not found', 404));
    }

    const inventory = await VendorProductPricing.find({
      vendor_id: warehouse._id,
      isActive: true,
    })
      .populate('product_id', 'name images mrp sellingPrice category_id brand_id')
      .populate('product_id.category_id', 'name')
      .populate('product_id.brand_id', 'name')
      .sort({ createdAt: -1 });

    // Get total inventory value
    const totalValue = inventory.reduce((sum, item) => {
      return sum + (item.availableStock * item.purchasePrice);
    }, 0);

    // Get low stock items (less than 10 units)
    const lowStockItems = inventory.filter(item => item.availableStock < 10);

    // Get out of stock items
    const outOfStockItems = inventory.filter(item => item.availableStock === 0);

    res.status(200).json({
      success: true,
      data: {
        inventory,
        statistics: {
          totalProducts: inventory.length,
          totalValue,
          lowStockItems: lowStockItems.length,
          outOfStockItems: outOfStockItems.length,
        },
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Add product to warehouse inventory
 */
export const addProductToWarehouse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { product_id, purchasePercentage, availableStock } = req.body;

    if (!product_id || !purchasePercentage || availableStock === undefined) {
      return next(new AppError('Product ID, purchase percentage, and stock are required', 400));
    }

    const warehouse = await User.findOne({
      role: 'vendor',
      vendorType: { $in: ['WAREHOUSE', 'MY_SHOP'] },
      isApproved: true,
    });

    if (!warehouse) {
      return next(new AppError('Warehouse not found', 404));
    }

    const product = await Product.findById(product_id);
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Check if product already exists in warehouse
    const existing = await VendorProductPricing.findOne({
      vendor_id: warehouse._id,
      product_id,
    });

    if (existing) {
      return next(new AppError('Product already exists in warehouse inventory', 400));
    }

    const purchasePrice = product.mrp * (purchasePercentage / 100);

    const inventory = await VendorProductPricing.create({
      vendor_id: warehouse._id,
      product_id,
      purchasePercentage,
      purchasePrice,
      availableStock,
      isActive: true,
    });

    await inventory.populate('product_id', 'name images mrp sellingPrice');

    res.status(201).json({
      success: true,
      message: 'Product added to warehouse inventory',
      data: { inventory },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Update warehouse inventory item
 */
export const updateWarehouseInventory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { purchasePercentage, availableStock, isActive } = req.body;

    const inventory = await VendorProductPricing.findById(id);
    if (!inventory) {
      return next(new AppError('Inventory item not found', 404));
    }

    // Update fields
    if (purchasePercentage !== undefined) {
      inventory.purchasePercentage = purchasePercentage;
      // Purchase price will be auto-calculated by pre-save hook
    }
    if (availableStock !== undefined) {
      inventory.availableStock = availableStock;
    }
    if (isActive !== undefined) {
      inventory.isActive = isActive;
    }

    await inventory.save();
    await inventory.populate('product_id', 'name images mrp sellingPrice');

    res.status(200).json({
      success: true,
      message: 'Inventory updated successfully',
      data: { inventory },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Bulk add products to warehouse
 */
export const bulkAddToWarehouse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return next(new AppError('Products array is required', 400));
    }

    const warehouse = await User.findOne({
      role: 'vendor',
      vendorType: { $in: ['WAREHOUSE', 'MY_SHOP'] },
      isApproved: true,
    });

    if (!warehouse) {
      return next(new AppError('Warehouse not found', 404));
    }

    const results: {
      success: Array<{ product_id: any; action: string }>;
      failed: Array<{ product_id: any; reason: string }>;
    } = {
      success: [],
      failed: [],
    };

        for (const item of products) {
          try {
            const { product_id, purchasePercentage, availableStock } = item;

            const product = await Product.findById(product_id);
            if (!product) {
              results.failed.push({ product_id, reason: 'Product not found' });
              continue;
            }

            // Check if already exists
            const existing = await VendorProductPricing.findOne({
              vendor_id: warehouse._id,
              product_id,
            });

            if (existing) {
              // Update existing
              existing.purchasePercentage = purchasePercentage;
              existing.availableStock = availableStock;
              await existing.save();
              results.success.push({ product_id, action: 'updated' });
            } else {
              // Create new
              const purchasePrice = product.mrp * (purchasePercentage / 100);
              await VendorProductPricing.create({
                vendor_id: warehouse._id,
                product_id,
                purchasePercentage,
                purchasePrice,
                availableStock,
                isActive: true,
              });
              results.success.push({ product_id, action: 'created' });
            }
          } catch (error: any) {
            results.failed.push({ product_id: item.product_id, reason: error.message });
          }
        }

        res.status(200).json({
          success: true,
          message: `Processed ${products.length} products. Success: ${results.success.length}, Failed: ${results.failed.length}`,
          data: results,
        });
      } catch (error: any) {
        next(error);
      }
};

/**
 * Get warehouse dashboard statistics
 */
export const getWarehouseDashboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const warehouse = await User.findOne({
      role: 'vendor',
      vendorType: { $in: ['WAREHOUSE', 'MY_SHOP'] },
      isApproved: true,
    });

    if (!warehouse) {
      return next(new AppError('Warehouse not found', 404));
    }

    // Get inventory statistics
    const inventory = await VendorProductPricing.find({
      vendor_id: warehouse._id,
      isActive: true,
    }).populate('product_id');

    const totalProducts = inventory.length;
    const totalInventoryValue = inventory.reduce((sum, item) => {
      return sum + (item.availableStock * item.purchasePrice);
    }, 0);
    const lowStockItems = inventory.filter(item => item.availableStock < 10).length;
    const outOfStockItems = inventory.filter(item => item.availableStock === 0).length;

    // Get order statistics
    const totalOrders = await Order.countDocuments({
      assignedVendorId: warehouse._id,
    });

    const pendingOrders = await Order.countDocuments({
      assignedVendorId: warehouse._id,
      status: 'PENDING',
    });

    const deliveredOrders = await Order.countDocuments({
      assignedVendorId: warehouse._id,
      status: 'DELIVERED',
    });

    // Get recent orders
    const recentOrders = await Order.find({
      assignedVendorId: warehouse._id,
    })
      .populate('customer_id', 'name email')
      .populate('items.product_id', 'name images')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get wallet/earnings
    const wallet = await Wallet.findOne({ vendor_id: warehouse._id });

    res.status(200).json({
      success: true,
      data: {
        inventory: {
          totalProducts,
          totalInventoryValue,
          lowStockItems,
          outOfStockItems,
        },
        orders: {
          totalOrders,
          pendingOrders,
          deliveredOrders,
          recentOrders,
        },
        earnings: {
          currentBalance: wallet?.balance || 0,
          totalEarnings: wallet?.totalEarnings || 0,
        },
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get low stock products
 */
export const getLowStockProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { threshold = 10 } = req.query;

    const warehouse = await User.findOne({
      role: 'vendor',
      vendorType: { $in: ['WAREHOUSE', 'MY_SHOP'] },
      isApproved: true,
    });

    if (!warehouse) {
      return next(new AppError('Warehouse not found', 404));
    }

    const lowStockProducts = await VendorProductPricing.find({
      vendor_id: warehouse._id,
      isActive: true,
      availableStock: { $lt: Number(threshold) },
    })
      .populate('product_id', 'name images mrp sellingPrice category_id brand_id')
      .sort({ availableStock: 1 });

    res.status(200).json({
      success: true,
      data: { products: lowStockProducts },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get products not in warehouse
 */
export const getProductsNotInWarehouse = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const warehouse = await User.findOne({
      role: 'vendor',
      vendorType: { $in: ['WAREHOUSE', 'MY_SHOP'] },
      isApproved: true,
    });

    if (!warehouse) {
      return next(new AppError('Warehouse not found', 404));
    }

    // Get all product IDs in warehouse
    const warehouseProducts = await VendorProductPricing.find({
      vendor_id: warehouse._id,
    }).select('product_id');

    const warehouseProductIds = warehouseProducts.map(p => p.product_id);

    // Get products not in warehouse
    const availableProducts = await Product.find({
      _id: { $nin: warehouseProductIds },
      isActive: true,
    })
      .populate('category_id', 'name')
      .populate('brand_id', 'name')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: { products: availableProducts },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Record a manual store sale
 */
export const recordStoreSale = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { product_id, quantity, notes } = req.body;

    if (!product_id || !quantity) {
      return next(new AppError('Product ID and quantity are required', 400));
    }

    const warehouse = await User.findOne({
      role: 'vendor',
      vendorType: { $in: ['WAREHOUSE', 'MY_SHOP'] },
      isApproved: true,
    });

    if (!warehouse) {
      return next(new AppError('Warehouse not found', 404));
    }

    const sale = await SalesService.recordSale({
      vendor_id: warehouse._id.toString(),
      product_id,
      quantity,
      saleType: 'STORE',
      soldBy: req.user!._id.toString(),
      notes,
    });

    await sale.populate('product_id', 'name images');

    res.status(201).json({
      success: true,
      message: 'Store sale recorded successfully',
      data: { sale },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get sales history
 */
export const getSalesHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { saleType, startDate, endDate, product_id, limit = 50, skip = 0 } = req.query;

    const warehouse = await User.findOne({
      role: 'vendor',
      vendorType: { $in: ['WAREHOUSE', 'MY_SHOP'] },
      isApproved: true,
    });

    if (!warehouse) {
      return next(new AppError('Warehouse not found', 404));
    }

    const result = await SalesService.getSalesHistory({
      vendor_id: warehouse._id.toString(),
      saleType: saleType as 'WEBSITE' | 'STORE' | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      product_id: product_id as string | undefined,
      limit: Number(limit),
      skip: Number(skip),
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get sales analytics
 */
export const getSalesAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;

    const warehouse = await User.findOne({
      role: 'vendor',
      vendorType: { $in: ['WAREHOUSE', 'MY_SHOP'] },
      isApproved: true,
    });

    if (!warehouse) {
      return next(new AppError('Warehouse not found', 404));
    }

    const analytics = await SalesService.getSalesAnalytics({
      vendor_id: warehouse._id.toString(),
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get top selling products
 */
export const getTopSellingProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { saleType, limit = 10 } = req.query;

    const warehouse = await User.findOne({
      role: 'vendor',
      vendorType: { $in: ['WAREHOUSE', 'MY_SHOP'] },
      isApproved: true,
    });

    if (!warehouse) {
      return next(new AppError('Warehouse not found', 404));
    }

    const topProducts = await SalesService.getTopSellingProducts({
      vendor_id: warehouse._id.toString(),
      saleType: saleType as 'WEBSITE' | 'STORE' | undefined,
      limit: Number(limit),
    });

    res.status(200).json({
      success: true,
      data: { products: topProducts },
    });
  } catch (error: any) {
    next(error);
  }
};
