import SalesHistory from '../models/SalesHistory';
import VendorProductPricing from '../models/VendorProductPricing';
import { AppError } from '../middlewares/errorHandler';

export class SalesService {
  /**
   * Record a sale (website or store)
   * Automatically updates stock and sales counters
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

    // Get vendor product pricing
    const pricing = await VendorProductPricing.findOne({
      vendor_id,
      product_id,
      isActive: true,
    });

    if (!pricing) {
      throw new AppError('Product not found in vendor inventory', 404);
    }

    // Check if sufficient stock available
    if (pricing.availableStock < quantity) {
      throw new AppError(
        `Insufficient stock. Available: ${pricing.availableStock}, Required: ${quantity}`,
        400
      );
    }

    // Calculate prices
    const purchasePrice = pricing.purchasePrice;
    const totalPurchasePrice = purchasePrice * quantity;

    let totalSellingPrice: number | undefined;
    let profit: number | undefined;

    if (saleType === 'WEBSITE' && sellingPrice) {
      totalSellingPrice = sellingPrice * quantity;
      profit = totalSellingPrice - totalPurchasePrice;
    }

    // Create sales history record
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

    // Update inventory and sales counters
    if (selectedVariant && selectedVariant.weight && selectedVariant.unit) {
      // Update variant-specific stock
      const variantIndex = pricing.variantStock?.findIndex(
        (v: any) => v.weight === selectedVariant.weight && v.unit === selectedVariant.unit
      );

      if (variantIndex !== undefined && variantIndex >= 0 && pricing.variantStock) {
        // Check if variant has sufficient stock
        const variantStock = pricing.variantStock[variantIndex];
        if (variantStock.availableStock < quantity) {
          throw new AppError(
            `Insufficient variant stock. Available: ${variantStock.availableStock}, Required: ${quantity}`,
            400
          );
        }

        // Update variant stock
        pricing.variantStock[variantIndex].availableStock -= quantity;
        if (saleType === 'WEBSITE') {
          pricing.variantStock[variantIndex].totalSoldWebsite += quantity;
        } else {
          pricing.variantStock[variantIndex].totalSoldStore += quantity;
        }
        pricing.markModified('variantStock');
        await pricing.save();
      } else {
        console.error(`Variant ${selectedVariant.weight}${selectedVariant.unit} not found in pricing`);
        throw new AppError('Variant not found in inventory', 404);
      }
    } else {
      // Update general product stock (non-variant or legacy)
      const updateFields: any = {
        $inc: {
          availableStock: -quantity,
        },
      };

      if (saleType === 'WEBSITE') {
        updateFields.$inc.totalSoldWebsite = quantity;
      } else {
        updateFields.$inc.totalSoldStore = quantity;
      }

      await VendorProductPricing.findByIdAndUpdate(pricing._id, updateFields);
    }

    return sale;
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
