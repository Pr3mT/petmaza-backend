import mongoose, { Schema, Document } from 'mongoose';

export interface ICoupon extends Document {
  code: string;
  description: string;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  minOrderValue?: number;
  maxDiscount?: number; // For percentage coupons, cap the discount amount
  validFrom: Date;
  validTo: Date;
  usageLimit?: number; // Total number of times coupon can be used
  usagePerUser?: number; // Max uses per customer
  usedCount: number;
  isActive: boolean;
  isFirstTimeOnly: boolean; // Only for customers who never ordered before
  applicableFor: 'ALL' | 'SPECIFIC_BRANDS' | 'SPECIFIC_CATEGORIES';
  brands?: mongoose.Types.ObjectId[]; // Brand-specific coupons
  categories?: string[]; // Category-specific coupons (e.g., 'Dog Food', 'Cat Food')
  usedBy: Array<{
    user_id: mongoose.Types.ObjectId;
    usageCount: number;
    lastUsedAt: Date;
  }>;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema: Schema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'FLAT'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderValue: {
      type: Number,
      default: 0,
    },
    maxDiscount: {
      type: Number,
      default: null, // null means no cap
    },
    validFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },
    validTo: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      default: null, // null means unlimited
    },
    usagePerUser: {
      type: Number,
      default: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFirstTimeOnly: {
      type: Boolean,
      default: false,
    },
    applicableFor: {
      type: String,
      enum: ['ALL', 'SPECIFIC_BRANDS', 'SPECIFIC_CATEGORIES'],
      default: 'ALL',
    },
    brands: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Brand',
      },
    ],
    categories: [
      {
        type: String,
      },
    ],
    usedBy: [
      {
        user_id: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        usageCount: {
          type: Number,
          default: 0,
        },
        lastUsedAt: {
          type: Date,
        },
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
CouponSchema.index({ code: 1, isActive: 1 });
CouponSchema.index({ validFrom: 1, validTo: 1 });

export default mongoose.model<ICoupon>('Coupon', CouponSchema);
