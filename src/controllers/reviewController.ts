import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review';
import Order from '../models/Order';
import Product from '../models/Product';

// Create a review
export const createReview = async (req: Request, res: Response) => {
  try {
    const { product_id, order_id, rating, title, comment, images } = req.body;
    
    // Check if user is authenticated
    const user = (req as any).user;
    if (!user) {
      console.log('❌ User not authenticated - req.user is missing');
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }
    
    // Get customer ID - handle both _id and id
    const customer_id = user._id || user.id;
    
    if (!customer_id) {
      console.log('❌ User object exists but has no ID:', user);
      return res.status(401).json({ 
        success: false,
        message: 'Invalid user data' 
      });
    }

    console.log('📝 Creating review with data:', { 
      product_id, 
      order_id, 
      rating, 
      title, 
      comment,
      customer_id,
      userEmail: user.email 
    });

    // Validate required fields
    if (!product_id || !order_id || !rating) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: product_id, order_id, and rating are required' 
      });
    }

    // First, check if order exists at all
    const orderExists = await Order.findById(order_id);
    if (!orderExists) {
      console.log('❌ Order not found:', order_id);
      return res.status(400).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    console.log('✅ Order found:', orderExists._id, 'Status:', orderExists.status);

    // Check if order belongs to customer
    const orderCustomerId = orderExists.customer_id;
    if (orderCustomerId?.toString() !== customer_id.toString()) {
      console.log('❌ Order does not belong to customer');
      return res.status(403).json({ 
        success: false,
        message: 'This order does not belong to you' 
      });
    }

    console.log('✅ Order belongs to customer');

    // Verify product is in the order
    const productInOrder = orderExists.items.some(item => {
      return item.product_id?.toString() === product_id.toString();
    });
    
    if (!productInOrder) {
      console.log('❌ Product not in order. Order items:', orderExists.items.map(i => i.product_id));
      return res.status(400).json({ 
        success: false,
        message: 'Product not found in this order' 
      });
    }

    console.log('✅ Product is in order');

    // Check if review already exists
    const existingReview = await Review.findOne({ product_id, order_id, customer_id });
    if (existingReview) {
      console.log('❌ Review already exists');
      return res.status(400).json({ 
        success: false,
        message: 'You have already reviewed this product for this order' 
      });
    }

    console.log('✅ No existing review found, creating new review...');

    // Create the review
    const review = await Review.create({
      product_id,
      customer_id,
      order_id,
      rating,
      title: title || '',
      comment: comment || '',
      images: images || [],
      isVerifiedPurchase: true,
      status: 'approved',
    });

    await review.populate('customer_id', 'name');

    console.log('✅ Review created successfully:', review._id);

    // Update product rating statistics
    await updateProductRatings(product_id);

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully!',
      review,
    });
  } catch (error: any) {
    console.error('❌ ============ CREATE REVIEW ERROR ============');
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    console.error('Error stack:', error.stack);
    console.error('Full error:', JSON.stringify(error, null, 2));
    console.error('============================================');
    
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
      error: error.message || 'Unknown error',
      errorName: error.name,
    });
  }
};

// Helper function to update product ratings
async function updateProductRatings(productId: any) {
  try {
    // Convert to ObjectId if it's a string
    const prodId = typeof productId === 'string' 
      ? new mongoose.Types.ObjectId(productId) 
      : productId;
    
    const stats = await Review.aggregate([
      { 
        $match: { 
          product_id: prodId, 
          status: 'approved' 
        } 
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      await Product.findByIdAndUpdate(productId, {
        averageRating: Math.round(stats[0].averageRating * 10) / 10, // Round to 1 decimal
        totalReviews: stats[0].totalReviews,
      });
      console.log('✅ Product ratings updated:', productId);
    }
  } catch (error) {
    console.error('❌ Error updating product ratings:', error);
    // Don't throw - review is already created
  }
}

// Get reviews for a product
export const getProductReviews = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, rating, sort = '-createdAt' } = req.query;

    const filter: any = { product_id: productId, status: 'approved' };
    if (rating) {
      filter.rating = parseInt(rating as string);
    }

    const reviews = await Review.find(filter)
      .populate('customer_id', 'name')
      .sort(sort as string)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Review.countDocuments(filter);

    // Calculate rating statistics
    const statsResult = await Review.aggregate([
      { $match: { product_id: productId, status: 'approved' } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        },
      },
    ]);

    const statsData = statsResult[0] || {
      averageRating: 0,
      totalReviews: 0,
      rating5: 0,
      rating4: 0,
      rating3: 0,
      rating2: 0,
      rating1: 0,
    };

    res.status(200).json({
      reviews,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
      stats: {
        averageRating: statsData.averageRating,
        totalReviews: statsData.totalReviews,
        ratingDistribution: {
          5: statsData.rating5,
          4: statsData.rating4,
          3: statsData.rating3,
          2: statsData.rating2,
          1: statsData.rating1,
        },
      },
    });
  } catch (error: any) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Failed to fetch reviews', error: error.message });
  }
};

// Get customer's reviews
export const getCustomerReviews = async (req: Request, res: Response) => {
  try {
    const customer_id = (req as any).user.id;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ customer_id })
      .populate('product_id', 'name images')
      .sort('-createdAt')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Review.countDocuments({ customer_id });

    res.status(200).json({
      reviews,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('Get customer reviews error:', error);
    res.status(500).json({ message: 'Failed to fetch reviews', error: error.message });
  }
};

// Update a review
export const updateReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const customer_id = (req as any).user.id;
    const { rating, title, comment, images } = req.body;

    const review = await Review.findOne({ _id: reviewId, customer_id });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (rating !== undefined) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.comment = comment;
    if (images !== undefined) review.images = images;

    await review.save();

    res.status(200).json({
      message: 'Review updated successfully',
      review,
    });
  } catch (error: any) {
    console.error('Update review error:', error);
    res.status(500).json({ message: 'Failed to update review', error: error.message });
  }
};

// Delete a review
export const deleteReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const customer_id = (req as any).user.id;

    const review = await Review.findOneAndDelete({ _id: reviewId, customer_id });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.status(200).json({
      message: 'Review deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Failed to delete review', error: error.message });
  }
};

// Mark review as helpful
export const markReviewHelpful = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findByIdAndUpdate(
      reviewId,
      { $inc: { helpfulCount: 1 } },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.status(200).json({
      message: 'Review marked as helpful',
      helpfulCount: review.helpfulCount,
    });
  } catch (error: any) {
    console.error('Mark helpful error:', error);
    res.status(500).json({ message: 'Failed to mark review as helpful', error: error.message });
  }
};

// Vendor response to review
export const respondToReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { comment } = req.body;
    const vendor_id = (req as any).user.id;

    const review = await Review.findById(reviewId).populate('product_id');
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Verify vendor has access to this product
    const product: any = review.product_id;
    if (product.primeVendor_id?.toString() !== vendor_id) {
      return res.status(403).json({ message: 'Not authorized to respond to this review' });
    }

    review.vendorResponse = {
      comment,
      respondedAt: new Date(),
      respondedBy: vendor_id,
    };

    await review.save();

    res.status(200).json({
      message: 'Response added successfully',
      review,
    });
  } catch (error: any) {
    console.error('Respond to review error:', error);
    res.status(500).json({ message: 'Failed to respond to review', error: error.message });
  }
};

// Get reviewable products for customer
export const getReviewableProducts = async (req: Request, res: Response) => {
  try {
    const customer_id = (req as any).user.id;

    // Get delivered orders
    const orders = await Order.find({ customer_id, status: 'DELIVERED' })
      .populate('items.product_id')
      .sort('-createdAt');

    // Get all reviewed product-order combinations
    const reviews = await Review.find({ customer_id }).select('product_id order_id');
    const reviewedCombos = new Set(
      reviews.map(r => `${r.product_id}_${r.order_id}`)
    );

    // Extract reviewable products
    const reviewableProducts = [];
    for (const order of orders) {
      for (const item of order.items) {
        const combo = `${item.product_id}_${order._id}`;
        if (!reviewedCombos.has(combo)) {
          reviewableProducts.push({
            product: item.product_id,
            order_id: order._id,
            orderedAt: order.createdAt,
          });
        }
      }
    }

    res.status(200).json({
      reviewableProducts,
    });
  } catch (error: any) {
    console.error('Get reviewable products error:', error);
    res.status(500).json({ message: 'Failed to fetch reviewable products', error: error.message });
  }
};
