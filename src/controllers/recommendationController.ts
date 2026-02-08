import { Request, Response } from 'express';
import recommendationService from '../services/recommendationService';

// Get personalized recommendations for logged-in user
export const getPersonalizedRecommendations = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.id;
    const { limit = 10 } = req.query;

    const recommendations = await recommendationService.getPersonalizedRecommendations(
      customerId,
      Number(limit)
    );

    res.status(200).json({
      recommendations,
      type: 'personalized',
    });
  } catch (error: any) {
    console.error('Get personalized recommendations error:', error);
    res.status(500).json({ message: 'Failed to fetch recommendations', error: error.message });
  }
};

// Get similar products
export const getSimilarProducts = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { limit = 6 } = req.query;

    const similarProducts = await recommendationService.getSimilarProducts(
      productId,
      Number(limit)
    );

    res.status(200).json({
      products: similarProducts,
      type: 'similar',
    });
  } catch (error: any) {
    console.error('Get similar products error:', error);
    res.status(500).json({ message: 'Failed to fetch similar products', error: error.message });
  }
};

// Get trending products
export const getTrendingProducts = async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    const trendingProducts = await recommendationService.getTrendingProducts(Number(limit));

    res.status(200).json({
      products: trendingProducts,
      type: 'trending',
    });
  } catch (error: any) {
    console.error('Get trending products error:', error);
    res.status(500).json({ message: 'Failed to fetch trending products', error: error.message });
  }
};

// Get top rated products
export const getTopRatedProducts = async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    const topRatedProducts = await recommendationService.getTopRatedProducts(Number(limit));

    res.status(200).json({
      products: topRatedProducts,
      type: 'top_rated',
    });
  } catch (error: any) {
    console.error('Get top rated products error:', error);
    res.status(500).json({ message: 'Failed to fetch top rated products', error: error.message });
  }
};

// Get frequently bought together
export const getFrequentlyBoughtTogether = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { limit = 5 } = req.query;

    const products = await recommendationService.getFrequentlyBoughtTogether(
      productId,
      Number(limit)
    );

    res.status(200).json({
      products,
      type: 'frequently_bought_together',
    });
  } catch (error: any) {
    console.error('Get frequently bought together error:', error);
    res.status(500).json({
      message: 'Failed to fetch frequently bought together products',
      error: error.message,
    });
  }
};

// Get homepage recommendations (combination of different types)
export const getHomepageRecommendations = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const [trending, topRated, featured] = await Promise.all([
      recommendationService.getTrendingProducts(8),
      recommendationService.getTopRatedProducts(8),
      userId
        ? recommendationService.getPersonalizedRecommendations(userId, 8)
        : recommendationService.getFeaturedProducts(8),
    ]);

    res.status(200).json({
      trending,
      topRated,
      forYou: featured,
    });
  } catch (error: any) {
    console.error('Get homepage recommendations error:', error);
    res.status(500).json({
      message: 'Failed to fetch homepage recommendations',
      error: error.message,
    });
  }
};
