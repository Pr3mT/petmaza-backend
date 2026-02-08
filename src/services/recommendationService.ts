import Product from '../models/Product';
import Order from '../models/Order';
import Review from '../models/Review';
import { Types } from 'mongoose';

class RecommendationService {
  // Get personalized recommendations for a customer
  async getPersonalizedRecommendations(customerId: string, limit: number = 10) {
    try {
      // Get customer's order history
      const orders = await Order.find({ customer_id: customerId })
        .select('items')
        .sort('-createdAt')
        .limit(10);

      // Extract purchased product IDs and category/brand patterns
      const purchasedProductIds = new Set<string>();
      const categoryIds = new Set<string>();
      const brandIds = new Set<string>();

      for (const order of orders) {
        for (const item of order.items) {
          purchasedProductIds.add(item.product_id.toString());
        }
      }

      // Get details of purchased products to understand preferences
      if (purchasedProductIds.size > 0) {
        const purchasedProducts = await Product.find({
          _id: { $in: Array.from(purchasedProductIds) },
        }).select('category_id brand_id');

        purchasedProducts.forEach(product => {
          categoryIds.add(product.category_id.toString());
          brandIds.add(product.brand_id.toString());
        });
      }

      // Build recommendation query
      const recommendationFilter: any = {
        isActive: true,
        _id: { $nin: Array.from(purchasedProductIds) }, // Exclude already purchased
      };

      // Prioritize products from same categories or brands
      if (categoryIds.size > 0 || brandIds.size > 0) {
        recommendationFilter.$or = [];
        if (categoryIds.size > 0) {
          recommendationFilter.$or.push({
            category_id: { $in: Array.from(categoryIds) },
          });
        }
        if (brandIds.size > 0) {
          recommendationFilter.$or.push({
            brand_id: { $in: Array.from(brandIds) },
          });
        }
      }

      // Get recommendations with ratings
      const recommendations = await Product.find(recommendationFilter)
        .populate('category_id', 'name')
        .populate('brand_id', 'name')
        .limit(limit)
        .sort('-createdAt');

      // Add average ratings
      const enrichedRecommendations = await this.enrichWithRatings(recommendations);

      return enrichedRecommendations;
    } catch (error) {
      console.error('Personalized recommendations error:', error);
      return [];
    }
  }

  // Get similar products based on a product
  async getSimilarProducts(productId: string, limit: number = 6) {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        return [];
      }

      // Find products in same category or brand
      const similarProducts = await Product.find({
        _id: { $ne: productId },
        isActive: true,
        $or: [
          { category_id: product.category_id },
          { brand_id: product.brand_id },
        ],
      })
        .populate('category_id', 'name')
        .populate('brand_id', 'name')
        .limit(limit)
        .sort('-createdAt');

      const enrichedProducts = await this.enrichWithRatings(similarProducts);
      return enrichedProducts;
    } catch (error) {
      console.error('Similar products error:', error);
      return [];
    }
  }

  // Get trending products (most ordered in last 30 days)
  async getTrendingProducts(limit: number = 10) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Aggregate orders to find most popular products
      const trendingProductIds = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            status: { $nin: ['CANCELLED', 'REJECTED'] },
          },
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product_id',
            orderCount: { $sum: 1 },
            totalQuantity: { $sum: '$items.quantity' },
          },
        },
        { $sort: { orderCount: -1, totalQuantity: -1 } },
        { $limit: limit },
      ]);

      if (trendingProductIds.length === 0) {
        return this.getFeaturedProducts(limit);
      }

      const productIds = trendingProductIds.map(item => item._id);
      const products = await Product.find({ _id: { $in: productIds }, isActive: true })
        .populate('category_id', 'name')
        .populate('brand_id', 'name');

      const enrichedProducts = await this.enrichWithRatings(products);
      return enrichedProducts;
    } catch (error) {
      console.error('Trending products error:', error);
      return [];
    }
  }

  // Get top rated products
  async getTopRatedProducts(limit: number = 10) {
    try {
      const topRatedProducts = await Review.aggregate([
        { $match: { status: 'approved' } },
        {
          $group: {
            _id: '$product_id',
            averageRating: { $avg: '$rating' },
            reviewCount: { $sum: 1 },
          },
        },
        { $match: { reviewCount: { $gte: 3 } } }, // At least 3 reviews
        { $sort: { averageRating: -1, reviewCount: -1 } },
        { $limit: limit },
      ]);

      if (topRatedProducts.length === 0) {
        return this.getFeaturedProducts(limit);
      }

      const productIds = topRatedProducts.map(item => item._id);
      const products = await Product.find({ _id: { $in: productIds }, isActive: true })
        .populate('category_id', 'name')
        .populate('brand_id', 'name');

      const enrichedProducts = products.map(product => {
        const ratingInfo = topRatedProducts.find(
          r => r._id.toString() === product._id.toString()
        );
        return {
          ...product.toObject(),
          averageRating: ratingInfo?.averageRating || 0,
          reviewCount: ratingInfo?.reviewCount || 0,
        };
      });

      return enrichedProducts;
    } catch (error) {
      console.error('Top rated products error:', error);
      return [];
    }
  }

  // Get featured/new products as fallback
  async getFeaturedProducts(limit: number = 10) {
    try {
      const products = await Product.find({ isActive: true })
        .populate('category_id', 'name')
        .populate('brand_id', 'name')
        .sort('-createdAt')
        .limit(limit);

      const enrichedProducts = await this.enrichWithRatings(products);
      return enrichedProducts;
    } catch (error) {
      console.error('Featured products error:', error);
      return [];
    }
  }

  // Get frequently bought together
  async getFrequentlyBoughtTogether(productId: string, limit: number = 5) {
    try {
      // Find orders containing this product
      const ordersWithProduct = await Order.find({
        'items.product_id': productId,
        status: 'DELIVERED',
      }).select('items');

      // Count co-occurrences
      const productCounts: Record<string, number> = {};
      
      for (const order of ordersWithProduct) {
        for (const item of order.items) {
          const itemProductId = item.product_id.toString();
          if (itemProductId !== productId) {
            productCounts[itemProductId] = (productCounts[itemProductId] || 0) + 1;
          }
        }
      }

      // Sort by frequency and get top products
      const sortedProducts = Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => id);

      if (sortedProducts.length === 0) {
        return this.getSimilarProducts(productId, limit);
      }

      const products = await Product.find({ _id: { $in: sortedProducts }, isActive: true })
        .populate('category_id', 'name')
        .populate('brand_id', 'name');

      const enrichedProducts = await this.enrichWithRatings(products);
      return enrichedProducts;
    } catch (error) {
      console.error('Frequently bought together error:', error);
      return [];
    }
  }

  // Helper: Enrich products with rating information
  private async enrichWithRatings(products: any[]) {
    try {
      const productIds = products.map(p => p._id);
      
      const ratings = await Review.aggregate([
        {
          $match: {
            product_id: { $in: productIds },
            status: 'approved',
          },
        },
        {
          $group: {
            _id: '$product_id',
            averageRating: { $avg: '$rating' },
            reviewCount: { $sum: 1 },
          },
        },
      ]);

      const ratingMap = new Map(
        ratings.map(r => [r._id.toString(), r])
      );

      return products.map(product => {
        const ratingInfo = ratingMap.get(product._id.toString());
        return {
          ...product.toObject(),
          averageRating: ratingInfo?.averageRating || 0,
          reviewCount: ratingInfo?.reviewCount || 0,
        };
      });
    } catch (error) {
      console.error('Enrich with ratings error:', error);
      return products;
    }
  }
}

export default new RecommendationService();
