import mongoose, { Schema } from 'mongoose';
import { IProduct } from '../types';

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Please provide a product name'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category_id: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: false, // Optional - using mainCategory/subCategory now
    },
    brand_id: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      required: [true, 'Please provide a brand'],
    },
    mainCategory: {
      type: String,
      enum: ['Dog', 'Cat', 'Fish', 'Bird', 'Small Animals'],
      required: [true, 'Please provide a main category'],
      trim: true,
    },
    subCategory: {
      type: String,
      required: [true, 'Please provide a subcategory'],
      trim: true,
    },
    weight: {
      type: Number,
      min: 0,
    },
    unit: {
      type: String,
      enum: ['g', 'kg', 'ml', 'l'],
    },
    displayWeight: {
      type: String,
    },
    hasVariants: {
      type: Boolean,
      default: false,
    },
    variants: [{
      // Optional size for apparel/harness variants (S, M, L, XL, 2XL, etc.)
      size: { type: String },
      weight: { type: Number, min: 0 },
      unit: { type: String, enum: ['g', 'kg', 'ml', 'l'] },
      displayWeight: { type: String },
      mrp: { type: Number, min: 0 },
      sellingPercentage: { type: Number, min: 0, max: 100 },
      sellingPrice: { type: Number, min: 0 },
      discount: { type: Number, min: 0, max: 100 },
      purchasePercentage: { type: Number, min: 0, max: 100 },
      purchasePrice: { type: Number, min: 0 },
      isActive: { type: Boolean, default: true },
      totalSoldWebsite: { type: Number, default: 0, min: 0 },
      totalSoldStore: { type: Number, default: 0, min: 0 },
    }],
    mrp: {
      type: Number,
      required: function() {
        return !this.hasVariants;
      },
      min: 0,
    },
    sellingPercentage: {
      type: Number,
      required: function() {
        // Not required for Prime products or products with variants
        return !this.hasVariants && !this.isPrime;
      },
      min: 0,
      max: 100,
    },
    sellingPrice: {
      type: Number,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    purchasePercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 60,
    },
    purchasePrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    isPrime: {
      type: Boolean,
      default: false,
    },
    primeVendor_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: function() {
        return this.isPrime === true;
      },
    },
    images: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    inStock: {
      type: Boolean,
      default: true,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    totalSoldWebsite: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSoldStore: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-calculate percentages from prices before saving
productSchema.pre('save', function (next) {
  // Handle variants - prices are primary, calculate percentages from them
  if (this.hasVariants && this.variants && this.variants.length > 0) {
    this.variants.forEach((variant: any) => {
      const mrp = variant.mrp;
      if (!mrp) return;

      if (variant.sellingPrice !== undefined && variant.sellingPrice !== null) {
        // Price is primary: calculate percentage and discount from price
        variant.sellingPercentage = mrp > 0 ? Math.round((variant.sellingPrice / mrp) * 100 * 100) / 100 : 0;
        variant.discount = mrp > 0 ? Math.round(((mrp - variant.sellingPrice) / mrp) * 100 * 100) / 100 : 0;
      } else if (variant.sellingPercentage !== undefined) {
        // Fallback: calculate price from percentage
        variant.sellingPrice = Math.round(mrp * (variant.sellingPercentage / 100) * 100) / 100;
        variant.discount = mrp > 0 ? Math.round(((mrp - variant.sellingPrice) / mrp) * 100 * 100) / 100 : 0;
      }

      if (variant.purchasePrice !== undefined && variant.purchasePrice !== null) {
        variant.purchasePercentage = mrp > 0 ? Math.round((variant.purchasePrice / mrp) * 100 * 100) / 100 : 0;
      } else if (variant.purchasePercentage !== undefined) {
        variant.purchasePrice = Math.round(mrp * (variant.purchasePercentage / 100) * 100) / 100;
      }
    });
  }

  // Handle single product (no variants)
  const mrp = this.get('mrp') as number;
  if (mrp && !this.hasVariants) {
    const sellingPrice = this.get('sellingPrice') as number;
    const purchasePrice = this.get('purchasePrice') as number;

    if (sellingPrice !== undefined && sellingPrice !== null) {
      // Price is primary: calculate percentage and discount
      this.set('sellingPercentage', mrp > 0 ? Math.round((sellingPrice / mrp) * 100 * 100) / 100 : 0);
      this.set('discount', mrp > 0 ? Math.round(((mrp - sellingPrice) / mrp) * 100 * 100) / 100 : 0);
    } else {
      // Fallback: calculate price from percentage
      const sellingPercentage = this.get('sellingPercentage') as number;
      if (sellingPercentage !== undefined) {
        const sp = Math.round(mrp * (sellingPercentage / 100) * 100) / 100;
        this.set('sellingPrice', sp);
        this.set('discount', mrp > 0 ? Math.round(((mrp - sp) / mrp) * 100 * 100) / 100 : 0);
      }
    }

    if (purchasePrice !== undefined && purchasePrice !== null) {
      this.set('purchasePercentage', mrp > 0 ? Math.round((purchasePrice / mrp) * 100 * 100) / 100 : 0);
    } else {
      const purchasePercentage = this.get('purchasePercentage') as number;
      if (purchasePercentage !== undefined) {
        this.set('purchasePrice', Math.round(mrp * (purchasePercentage / 100) * 100) / 100);
      }
    }
  }

  next();
});

// Handle updates (findOneAndUpdate, updateOne, etc.)
productSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() as any;
  
  // Handle variant products
  if (update.hasVariants || update.variants) {
    if (update.variants && Array.isArray(update.variants)) {
      update.variants = update.variants.map((variant: any) => {
        const mrp = variant.mrp;
        if (!mrp) return variant;

        if (variant.sellingPrice !== undefined && variant.sellingPrice !== null) {
          variant.sellingPercentage = mrp > 0 ? Math.round((variant.sellingPrice / mrp) * 100 * 100) / 100 : 0;
          variant.discount = Math.round(((mrp - variant.sellingPrice) / mrp) * 100 * 100) / 100;
        } else if (variant.sellingPercentage !== undefined) {
          variant.sellingPrice = Math.round(mrp * (variant.sellingPercentage / 100) * 100) / 100;
          variant.discount = Math.round(((mrp - variant.sellingPrice) / mrp) * 100 * 100) / 100;
        }

        if (variant.purchasePrice !== undefined && variant.purchasePrice !== null) {
          variant.purchasePercentage = mrp > 0 ? Math.round((variant.purchasePrice / mrp) * 100 * 100) / 100 : 0;
        } else if (variant.purchasePercentage !== undefined) {
          variant.purchasePrice = Math.round(mrp * (variant.purchasePercentage / 100) * 100) / 100;
        }

        return variant;
      });
    }
  } else {
    const mrp = update.mrp;
    if (mrp) {
      if (update.sellingPrice !== undefined && update.sellingPrice !== null) {
        update.sellingPercentage = mrp > 0 ? Math.round((update.sellingPrice / mrp) * 100 * 100) / 100 : 0;
        update.discount = Math.round(((mrp - update.sellingPrice) / mrp) * 100 * 100) / 100;
      } else if (update.sellingPercentage !== undefined) {
        const sp = Math.round(mrp * (update.sellingPercentage / 100) * 100) / 100;
        update.sellingPrice = sp;
        update.discount = Math.round(((mrp - sp) / mrp) * 100 * 100) / 100;
      }

      if (update.purchasePrice !== undefined && update.purchasePrice !== null) {
        update.purchasePercentage = mrp > 0 ? Math.round((update.purchasePrice / mrp) * 100 * 100) / 100 : 0;
      } else if (update.purchasePercentage !== undefined) {
        update.purchasePrice = Math.round(mrp * (update.purchasePercentage / 100) * 100) / 100;
      }
    }
  }
  
  next();
});

// Indexes for better query performance
productSchema.index({ category_id: 1 });
productSchema.index({ brand_id: 1 });
productSchema.index({ mainCategory: 1 });
productSchema.index({ subCategory: 1 });
productSchema.index({ mainCategory: 1, subCategory: 1 }); // Compound index
productSchema.index({ isPrime: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ createdAt: -1 }); // For sorting by newest
productSchema.index({ category_id: 1, isActive: 1 }); // Compound index
productSchema.index({ brand_id: 1, isActive: 1 }); // Compound index
productSchema.index({ isPrime: 1, isActive: 1 }); // Compound index
productSchema.index({ name: 'text', description: 'text' }); // Text search index

const Product = mongoose.model<IProduct>('Product', productSchema);

export default Product;
