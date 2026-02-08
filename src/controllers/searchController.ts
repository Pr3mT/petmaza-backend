import { Request, Response } from 'express';
import Product from '../models/Product';
import Review from '../models/Review';

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
      sortBy = 'relevance', // relevance, price_asc, price_desc, rating, newest
      page = 1,
      limit = 20,
    } = req.query;

    // Build search filter
    const filter: any = { isActive: true };

    // Text search
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }

    // Category filter
    if (category_id) {
      filter.category_id = category_id;
    }

    // Brand filter (can be multiple)
    if (brand_id) {
      const brandIds = Array.isArray(brand_id) ? brand_id : [brand_id];
      filter.brand_id = { $in: brandIds };
    }

    // Price range filter
    if (minPrice || maxPrice) {
      filter.sellingPrice = {};
      if (minPrice) filter.sellingPrice.$gte = Number(minPrice);
      if (maxPrice) filter.sellingPrice.$lte = Number(maxPrice);
    }

    // Prime filter
    if (isPrime !== undefined) {
      filter.isPrime = isPrime === 'true';
    }

    // Build sort criteria
    let sortCriteria: any = {};
    switch (sortBy) {
      case 'price_asc':
        sortCriteria = { sellingPrice: 1 };
        break;
      case 'price_desc':
        sortCriteria = { sellingPrice: -1 };
        break;
      case 'newest':
        sortCriteria = { createdAt: -1 };
        break;
      case 'discount':
        sortCriteria = { discount: -1 };
        break;
      default:
        sortCriteria = { createdAt: -1 }; // Default to newest
    }

    // Execute search
    const products = await Product.find(filter)
      .populate('category_id', 'name image')
      .populate('brand_id', 'name image')
      .sort(sortCriteria)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Product.countDocuments(filter);

    // Enrich with ratings
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

    let enrichedProducts = products.map(product => {
      const ratingInfo = ratingMap.get(product._id.toString());
      return {
        ...product.toObject(),
        averageRating: ratingInfo?.averageRating || 0,
        reviewCount: ratingInfo?.reviewCount || 0,
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
    console.error('Advanced search error:', error);
    res.status(500).json({ message: 'Search failed', error: error.message });
  }
};

// Get search suggestions (autocomplete)
export const getSearchSuggestions = async (req: Request, res: Response) => {
  try {
    const { q, limit = 5 } = req.query;

    if (!q || (q as string).length < 2) {
      return res.status(200).json({ suggestions: [] });
    }

    const products = await Product.find({
      isActive: true,
      name: { $regex: q, $options: 'i' },
    })
      .select('name images')
      .limit(Number(limit))
      .sort({ name: 1 });

    const suggestions = products.map(p => ({
      id: p._id,
      name: p.name,
      image: p.images[0] || null,
    }));

    res.status(200).json({ suggestions });
  } catch (error: any) {
    console.error('Search suggestions error:', error);
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
    console.error('Get filter options error:', error);
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
    console.error('Get popular searches error:', error);
    res.status(500).json({
      message: 'Failed to fetch popular searches',
      error: error.message,
    });
  }
};
