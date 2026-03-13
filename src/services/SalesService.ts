import SalesHistory from '../models/SalesHistory';
import Product from '../models/Product';
import { AppError } from '../middlewares/errorHandler';

export class SalesService {
  /**
   * Record a sale (website or store)
   * Automatically updates sales counters in Products collection
   */
  static async recordSale(params: {
    vendor_id: string;
    product_id: string;
    quantity: number;
    saleType: 'WEBSITE' | 'STORE';
    soldBy: string; // User ID who recorded the sale
    order_id?: string; // For website sales
    sellingPrice?: number; // For website sales
    notes?: string; // For store sales
    selectedVariant?: { weight: number; unit: string; displayWeight?: string }; // For variant products
  }) {
    const {
      vendor_id,
      product_id,
      quantity,
      saleType,
      soldBy,
      order_id,
      sellingPrice,
      notes,
      selectedVariant,
    } = params;

    // Get product
    const product = await Product.findById(product_id);

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    if (!product.isActive) {
      throw new AppError('Product is not active', 400);
    }

    // Calculate prices
    const purchasePrice = product.hasVariants ? 0 : (product.purchasePrice || 0);
    const totalPurchasePrice = purchasePrice * quantity;

    let totalSellingPrice: number | undefined;
    let profit: number | undefined;

    if (saleType === 'WEBSITE' && sellingPrice) {
      totalSellingPrice = sellingPrice * quantity;
      profit = totalSellingPrice - totalPurchasePrice;
    }

    // Create sales history record for vendor-wise reporting
    const sale = await SalesHistory.create({
      vendor_id,
      product_id,
      quantity,
      purchasePrice,
      totalPurchasePrice,
      sellingPrice,
      totalSellingPrice,
      profit,
      saleType,
      order_id,
      soldBy,
      notes,
      saleDate: new Date(),
    });

    // Update product sales counters
    if (selectedVariant && selectedVariant.weight && selectedVariant.unit && product.hasVariants) {
      // Update variant-specific sales counters
      const variantIndex = product.variants?.findIndex(
        (v: any) => v.weight === selectedVariant.weight && v.unit === selectedVariant.unit
      );

      if (variantIndex !== undefined && variantIndex >= 0 && product.variants) {
        // Update sales counter for this variant
        if (saleType === 'WEBSITE') {
          product.variants[variantIndex].totalSoldWebsite = (product.variants[variantIndex].totalSoldWebsite || 0) + quantity;
        } else {
          product.variants[variantIndex].totalSoldStore = (product.variants[variantIndex].totalSoldStore || 0) + quantity;
        }
        product.markModified('variants');
        await product.save();
      } else {
        // Variant not found in variants array - update general counters instead
        console.log(`Variant ${selectedVariant.weight}${selectedVariant.unit} not in variants, updating general counters`);
        const updateFields: any = {
          $inc: {},
        };

        if (saleType === 'WEBSITE') {
          updateFields.$inc.totalSoldWebsite = quantity;
        } else {
          updateFields.$inc.totalSoldStore = quantity;
        }

        await Product.findByIdAndUpdate(product._id, updateFields);
      }
    } else {
      // Update general product sales counters
      const updateFields: any = {
        $inc: {},
      };

      if (saleType === 'WEBSITE') {
        updateFields.$inc.totalSoldWebsite = quantity;
      } else {
        updateFields.$inc.totalSoldStore = quantity;
      }

      await Product.findByIdAndUpdate(product._id, updateFields);
    }

    return sale;
  }

  /**
   * Reverse a sale (refund/cancellation)
   * Restores sales counters in Products collection
   */
  static async reverseSale(params: {
    vendor_id: string;
    product_id: string;
    quantity: number;
    order_id?: string;
    selectedVariant?: { weight: number; unit: string };
  }) {
    const { vendor_id, product_id, quantity, order_id, selectedVariant } = params;

    // Get product
    const product = await Product.findById(product_id);

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Mark the sale record as reversed in SalesHistory
    if (order_id) {
      await SalesHistory.updateMany(
        {
          vendor_id,
          product_id,
          order_id,
          isReversed: { $ne: true },
        },
        {
          $set: {
            isReversed: true,
            reversedAt: new Date(),
          },
        }
      );
    }

    // Reverse sales counters in Product
    if (selectedVariant && selectedVariant.weight && selectedVariant.unit && product.hasVariants) {
      // Reverse variant-specific sales counter
      const variantIndex = product.variants?.findIndex(
        (v: any) => v.weight === selectedVariant.weight && v.unit === selectedVariant.unit
      );

      if (variantIndex !== undefined && variantIndex >= 0 && product.variants) {
        // Reverse sales counter for this variant
        product.variants[variantIndex].totalSoldWebsite = Math.max(0, (product.variants[variantIndex].totalSoldWebsite || 0) - quantity);
        product.markModified('variants');
        await product.save();
      }
    } else {
      // Reverse general product sales counter
      await Product.findByIdAndUpdate(product._id, {
        $inc: {
          totalSoldWebsite: -quantity,
        },
      });
    }

    return { success: true, message: 'Sale reversed successfully' };
  }

  /**
   * Get sales history for a vendor
   */
  static async getSalesHistory(params: {
    vendor_id: string;
    saleType?: 'WEBSITE' | 'STORE';
    startDate?: Date;
    endDate?: Date;
    product_id?: string;
    limit?: number;
    skip?: number;
  }) {
    const {
      vendor_id,
      saleType,
      startDate,
      endDate,
      product_id,
      limit = 50,
      skip = 0,
    } = params;

    const query: any = { vendor_id };

    if (saleType) {
      query.saleType = saleType;
    }

    if (product_id) {
      query.product_id = product_id;
    }

    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) {
        query.saleDate.$gte = startDate;
      }
      if (endDate) {
        query.saleDate.$lte = endDate;
      }
    }

    const [sales, total] = await Promise.all([
      SalesHistory.find(query)
        .populate('product_id', 'name images')
        .populate('soldBy', 'name email')
        .populate('order_id', 'orderId')
        .sort({ saleDate: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      SalesHistory.countDocuments(query),
    ]);

    return {
      sales,
      total,
      limit,
      skip,
      hasMore: total > skip + limit,
    };
  }

  /**
   * Get sales analytics for a vendor
   */
  static async getSalesAnalytics(params: {
    vendor_id: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const { vendor_id, startDate, endDate } = params;

    const matchQuery: any = { vendor_id };

    if (startDate || endDate) {
      matchQuery.saleDate = {};
      if (startDate) {
        matchQuery.saleDate.$gte = startDate;
      }
      if (endDate) {
        matchQuery.saleDate.$lte = endDate;
      }
    }

    const analytics = await SalesHistory.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$saleType',
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: '$totalSellingPrice' },
          totalCost: { $sum: '$totalPurchasePrice' },
          totalProfit: { $sum: '$profit' },
          salesCount: { $sum: 1 },
        },
      },
    ]);

    const result: any = {
      website: {
        totalQuantity: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        salesCount: 0,
      },
      store: {
        totalQuantity: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        salesCount: 0,
      },
      overall: {
        totalQuantity: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        salesCount: 0,
      },
    };

    analytics.forEach((item) => {
      const type = item._id.toLowerCase();
      if (type === 'website' || type === 'store') {
        result[type] = {
          totalQuantity: item.totalQuantity,
          totalRevenue: item.totalRevenue || 0,
          totalCost: item.totalCost,
          totalProfit: item.totalProfit || 0,
          salesCount: item.salesCount,
        };
      }
    });

    // Calculate overall
    result.overall.totalQuantity =
      result.website.totalQuantity + result.store.totalQuantity;
    result.overall.totalRevenue =
      result.website.totalRevenue + result.store.totalRevenue;
    result.overall.totalCost = result.website.totalCost + result.store.totalCost;
    result.overall.totalProfit =
      result.website.totalProfit + result.store.totalProfit;
    result.overall.salesCount =
      result.website.salesCount + result.store.salesCount;

    return result;
  }

  /**
   * Get top selling products
   */
  static async getTopSellingProducts(params: {
    vendor_id: string;
    saleType?: 'WEBSITE' | 'STORE';
    limit?: number;
  }) {
    const { vendor_id, saleType, limit = 10 } = params;

    const matchQuery: any = { vendor_id };
    if (saleType) {
      matchQuery.saleType = saleType;
    }

    const topProducts = await SalesHistory.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$product_id',
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: '$totalSellingPrice' },
          totalProfit: { $sum: '$profit' },
          salesCount: { $sum: 1 },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $project: {
          product_id: '$_id',
          product_name: '$product.name',
          product_image: { $arrayElemAt: ['$product.images', 0] },
          totalQuantity: 1,
          totalRevenue: 1,
          totalProfit: 1,
          salesCount: 1,
        },
      },
    ]);

    return topProducts;
  }
}
