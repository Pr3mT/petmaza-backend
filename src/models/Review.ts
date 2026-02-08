import mongoose, { Schema } from 'mongoose';
import { Document, Types } from 'mongoose';

export interface IReview extends Document {
  product_id: Types.ObjectId | string;
  customer_id: Types.ObjectId | string;
  order_id: Types.ObjectId | string;
  rating: number; // 1-5 stars
  title?: string;
  comment?: string;
  images?: string[]; // Optional review images
  isVerifiedPurchase: boolean;
  helpfulCount: number; // Number of users who found this helpful
  status: 'pending' | 'approved' | 'rejected';
  moderatedBy?: Types.ObjectId | string; // Admin user ID
  moderatedAt?: Date;
  vendorResponse?: {
    comment: string;
    respondedAt: Date;
    respondedBy: Types.ObjectId | string; // Vendor user ID
  };
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    product_id: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    customer_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    order_id: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (images: string[]) => images.length <= 5,
        message: 'Maximum 5 images allowed per review',
      },
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: true,
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved', // Auto-approve by default
    },
    moderatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    moderatedAt: {
      type: Date,
    },
    vendorResponse: {
      comment: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
      respondedAt: {
        type: Date,
      },
      respondedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
reviewSchema.index({ product_id: 1 });
reviewSchema.index({ customer_id: 1 });
reviewSchema.index({ order_id: 1 });
reviewSchema.index({ status: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ createdAt: -1 });

// Compound index for efficient queries
reviewSchema.index({ product_id: 1, status: 1, createdAt: -1 });

// Prevent duplicate reviews for same product and order
reviewSchema.index({ product_id: 1, order_id: 1, customer_id: 1 }, { unique: true });

const Review = mongoose.model<IReview>('Review', reviewSchema);

export default Review;
