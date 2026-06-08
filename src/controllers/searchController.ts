import logger from '../config/logger';
import { Request, Response } from 'express';
import Product from '../models/Product';
import Review from '../models/Review';
import {
  parseQuery,
  resolveMatchingBrandIds,
  buildRelevancePipeline,
} from '../services/searchRelevance';

// Advanced product search with filters
export const advancedSearch = async (req: Request, res: Response) => {
  try {
    const {
      q, // Search query
      category_id,
      brand_id,
      minPrice,
      maxPrice,
      minRating,
      isPrime,
      mainCategory, // Pet type filter
      subCategory, // Subcategory filter
      sortBy = 'relevance', // relevance, price_asc, price_desc, rating, newest
      page = 1,
      limit = 20,
    } = req.query;

    // ── Facet (non-text) filters: applied as a plain $match before scoring ──
    const baseMatch: any = { isActive: true };

    if (category_id) baseMatch.category_id = category_id;
    if (mainCategory) baseMatch.mainCategory = mainCategory;
    if (subCategory) baseMatch.subCategory = subCategory;
    if (brand_id) {
      const brandIds = Array.isArray(brand_id) ? brand_id : [brand_id];
      baseMatch.brand_id = { $in: brandIds };
    }
    if (minPrice || maxPrice) {
      baseMatch.sellingPrice = {};
      if (minPrice) baseMatch.sellingPrice.$gte = Number(minPrice);
      if (maxPrice) baseMatch.sellingPrice.$lte = Number(maxPrice);
    }
    if (isPrime !== undefined) baseMatch.isPrime = isPrime === 'true';

    const skip = (Number(page) - 1) * Number(limit);
    let products: any[];
    let total: number;

    if (q && (q as string).trim()) {
      // ── Relevance-ranked text search via the scoring aggregation ──
      const parsed = parseQuery(q as string);
      const brandIds = await resolveMatchingBrandIds(parsed);
      const pipeline = buildRelevancePipeline(parsed, brandIds, {
        baseMatch,
        sortBy: sortBy as string,
        skip,
        limit: Number(limit),
      });
      const [result] = await Product.aggregate(pipeline);
      products = result?.data || [];
      total = result?.total?.[0]?.count || 0;
    } else {
      // ── No text query: plain filtered listing (sorted per sortBy) ──
      let sortCriteria: any;
      switch (sortBy) {
        case 'price_asc': sortCriteria = { sellingPrice: 1 }; break;
        case 'price_desc': sortCriteria = { sellingPrice: -1 }; break;
        case 'discount': sortCriteria = { discount: -1 }; break;
        case 'newest':
        default: sortCriteria = { createdAt: -1 };
      }
      [products, total] = await Promise.all([
        Product.find(baseMatch)
          .populate('category_id', 'name image')
          .populate('brand_id', 'name image')
          .sort(sortCriteria)
          .limit(Number(limit))
          .skip(skip)
          .lean(),
        Product.countDocuments(baseMatch),
      ]);
    }

    // Enrich with ratings
    const productIds = products.map((p) => p._id);
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

    let enrichedProducts = products.map((product: any) => {
      // product is already a plain object (aggregation result or .lean())
      const ratingInfo = ratingMap.get(product._id.toString());
      return {
        ...product,
        // Prefer freshly-aggregated review rating; fall back to stored field.
        averageRating: ratingInfo?.averageRating ?? product.averageRating ?? 0,
        reviewCount: ratingInfo?.reviewCount ?? product.totalReviews ?? 0,
      };
    });

    // Filter by minimum rating if specified
    if (minRating) {
      enrichedProducts = enrichedProducts.filter(
        p => p.averageRating >= Number(minRating)
      );
    }

    // Re-sort by rating if sortBy is 'rating'
    if (sortBy === 'rating') {
      enrichedProducts.sort((a, b) => b.averageRating - a.averageRating);
    }

    res.status(200).json({
      products: enrichedProducts,
      pagination: {
        total: minRating ? enrichedProducts.length : total,
        page: Number(page),
        pages: Math.ceil((minRating ? enrichedProducts.length : total) / Number(limit)),
        limit: Number(limit),
      },
      filters: {
        q,
        category_id,
        brand_id,
        minPrice,
        maxPrice,
        minRating,
        isPrime,
        sortBy,
      },
    });
  } catch (error: any) {
    logger.error('Advanced search error:', error);
    res.status(500).json({ message: 'Search failed', error: error.message });
  }
};

// Get search suggestions (autocomplete) — shares the same relevance engine as
// the full results page so dropdown order matches the page order.
export const getSearchSuggestions = async (req: Request, res: Response) => {
  try {
    const { q, limit = 8 } = req.query;
    const query = (q as string || '').trim();

    if (!query || query.length < 1) {
      return res.status(200).json({ suggestions: [] });
    }

    const parsed = parseQuery(query);
    if (!parsed.hasTokens) {
      return res.status(200).json({ suggestions: [] });
    }

    const brandIds = await resolveMatchingBrandIds(parsed);
    const pipeline = buildRelevancePipeline(parsed, brandIds, {
      baseMatch: { isActive: true },
      sortBy: 'relevance',
      skip: 0,
      limit: Number(limit),
      // Lightweight payload — the dropdown only needs id, name, image.
      projectFields: { _id: 1, name: 1, images: 1 },
    });

    const [result] = await Product.aggregate(pipeline);
    const products = result?.data || [];

    const suggestions = products.map((p: any) => ({
      id: p._id,
      name: p.name,
      image: Array.isArray(p.images) && p.images.length ? p.images[0] : null,
    }));

    res.status(200).json({ suggestions });
  } catch (error: any) {
    logger.error('Search suggestions error:', error);
    res.status(500).json({ message: 'Failed to fetch suggestions', error: error.message });
  }
};

// Get filter options (for filter sidebar)
export const getFilterOptions = async (req: Request, res: Response) => {
  try {
    const { category_id, q } = req.query;

    // Build base filter for products
    const baseFilter: any = { isActive: true };
    if (category_id) baseFilter.category_id = category_id;
    if (q) {
      baseFilter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }

    // Get available brands for current filter
    const brands = await Product.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: '$brand_id',
        },
      },
      {
        $lookup: {
          from: 'brands',
          localField: '_id',
          foreignField: '_id',
          as: 'brand',
        },
      },
      { $unwind: '$brand' },
      {
        $project: {
          _id: '$brand._id',
          name: '$brand.name',
          image: '$brand.image',
        },
      },
      { $sort: { name: 1 } },
    ]);

    // Get price range
    const priceRange = await Product.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$sellingPrice' },
          maxPrice: { $max: '$sellingPrice' },
        },
      },
    ]);

    // Get rating distribution
    const ratingDistribution = await Review.aggregate([
      { $match: { status: 'approved' } },
      {
        $group: {
          _id: '$product_id',
          averageRating: { $avg: '$rating' },
        },
      },
      {
        $bucket: {
          groupBy: '$averageRating',
          boundaries: [0, 1, 2, 3, 4, 5],
          default: 0,
          output: {
            count: { $sum: 1 },
          },
        },
      },
    ]);

    res.status(200).json({
      brands,
      priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 },
      ratingDistribution,
    });
  } catch (error: any) {
    logger.error('Get filter options error:', error);
    res.status(500).json({ message: 'Failed to fetch filter options', error: error.message });
  }
};

// Get popular search terms
export const getPopularSearches = async (req: Request, res: Response) => {
  try {
    // This could be enhanced with a search analytics collection
    // For now, return popular categories/brands
    const popularProducts = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'categories',
          localField: 'category_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category.name',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          term: '$_id',
          count: 1,
        },
      },
    ]);

    res.status(200).json({
      popularSearches: popularProducts,
    });
  } catch (error: any) {
    logger.error('Get popular searches error:', error);
    res.status(500).json({
      message: 'Failed to fetch popular searches',
      error: error.message,
    });
  }
};
