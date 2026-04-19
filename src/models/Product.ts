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
      // Always round prices to integers
      if (variant.mrp !== undefined) variant.mrp = Math.round(variant.mrp);
      const mrp = variant.mrp;
      if (!mrp) return;

      if (variant.sellingPrice !== undefined && variant.sellingPrice !== null) {
        // Price is primary: round then calculate percentage and discount from price
        variant.sellingPrice = Math.round(variant.sellingPrice);
        variant.sellingPercentage = mrp > 0 ? Math.round((variant.sellingPrice / mrp) * 100 * 100) / 100 : 0;
        variant.discount = mrp > 0 ? Math.round(((mrp - variant.sellingPrice) / mrp) * 100) : 0;
      } else if (variant.sellingPercentage !== undefined) {
        // Fallback: calculate price from percentage
        variant.sellingPrice = Math.round(mrp * (variant.sellingPercentage / 100));
        variant.discount = mrp > 0 ? Math.round(((mrp - variant.sellingPrice) / mrp) * 100) : 0;
      }

      if (variant.purchasePrice !== undefined && variant.purchasePrice !== null) {
        variant.purchasePrice = Math.round(variant.purchasePrice);
        variant.purchasePercentage = mrp > 0 ? Math.round((variant.purchasePrice / mrp) * 100 * 100) / 100 : 0;
      } else if (variant.purchasePercentage !== undefined) {
        variant.purchasePrice = Math.round(mrp * (variant.purchasePercentage / 100));
      }
    });
  }

  // Handle single product (no variants)
  const rawMrp = this.get('mrp') as number;
  if (rawMrp) this.set('mrp', Math.round(rawMrp));
  const mrp = this.get('mrp') as number;
  if (mrp && !this.hasVariants) {
    const rawSP = this.get('sellingPrice') as number;
    const rawPP = this.get('purchasePrice') as number;
    const sellingPrice = rawSP !== undefined && rawSP !== null ? Math.round(rawSP) : undefined;
    const purchasePrice = rawPP !== undefined && rawPP !== null ? Math.round(rawPP) : undefined;

    if (sellingPrice !== undefined && sellingPrice !== null) {
      // Price is primary: round then calculate percentage and discount
      this.set('sellingPrice', sellingPrice);
      this.set('sellingPercentage', mrp > 0 ? Math.round((sellingPrice / mrp) * 100 * 100) / 100 : 0);
      this.set('discount', mrp > 0 ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0);
    } else {
      // Fallback: calculate price from percentage
      const sellingPercentage = this.get('sellingPercentage') as number;
      if (sellingPercentage !== undefined) {
        const sp = Math.round(mrp * (sellingPercentage / 100));
        this.set('sellingPrice', sp);
        this.set('discount', mrp > 0 ? Math.round(((mrp - sp) / mrp) * 100) : 0);
      }
    }

    if (purchasePrice !== undefined && purchasePrice !== null) {
      this.set('purchasePrice', purchasePrice);
      this.set('purchasePercentage', mrp > 0 ? Math.round((purchasePrice / mrp) * 100 * 100) / 100 : 0);
    } else {
      const purchasePercentage = this.get('purchasePercentage') as number;
      if (purchasePercentage !== undefined) {
        this.set('purchasePrice', Math.round(mrp * (purchasePercentage / 100)));
      }
    }
  }

  next();
});

// Handle updates (findOneAndUpdate, updateOne, etc.)
productSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() as any;
  
  // Handle variant products
  if (update.hasVariants || update.variants || (update.$set && update.$set.variants)) {
    const variants = (update.$set && update.$set.variants) ? update.$set.variants : update.variants;
    if (variants && Array.isArray(variants)) {
      const rounded = variants.map((variant: any) => {
        if (variant.mrp !== undefined) variant.mrp = Math.round(variant.mrp);
        const mrp = variant.mrp;
        if (!mrp) return variant;

        if (variant.sellingPrice !== undefined && variant.sellingPrice !== null) {
          variant.sellingPrice = Math.round(variant.sellingPrice);
          variant.sellingPercentage = mrp > 0 ? Math.round((variant.sellingPrice / mrp) * 100 * 100) / 100 : 0;
          variant.discount = mrp > 0 ? Math.round(((mrp - variant.sellingPrice) / mrp) * 100) : 0;
        } else if (variant.sellingPercentage !== undefined) {
          variant.sellingPrice = Math.round(mrp * (variant.sellingPercentage / 100));
          variant.discount = mrp > 0 ? Math.round(((mrp - variant.sellingPrice) / mrp) * 100) : 0;
        }

        if (variant.purchasePrice !== undefined && variant.purchasePrice !== null) {
          variant.purchasePrice = Math.round(variant.purchasePrice);
          variant.purchasePercentage = mrp > 0 ? Math.round((variant.purchasePrice / mrp) * 100 * 100) / 100 : 0;
        } else if (variant.purchasePercentage !== undefined) {
          variant.purchasePrice = Math.round(mrp * (variant.purchasePercentage / 100));
        }

        return variant;
      });
      if (update.$set && update.$set.variants) {
        update.$set.variants = rounded;
      } else {
        update.variants = rounded;
      }
    }
  } else {
    const mrp = update.mrp ? Math.round(update.mrp) : undefined;
    if (mrp) {
      update.mrp = mrp;
      if (update.sellingPrice !== undefined && update.sellingPrice !== null) {
        update.sellingPrice = Math.round(update.sellingPrice);
        update.sellingPercentage = mrp > 0 ? Math.round((update.sellingPrice / mrp) * 100 * 100) / 100 : 0;
        update.discount = mrp > 0 ? Math.round(((mrp - update.sellingPrice) / mrp) * 100) : 0;
      } else if (update.sellingPercentage !== undefined) {
        update.sellingPrice = Math.round(mrp * (update.sellingPercentage / 100));
        update.discount = mrp > 0 ? Math.round(((mrp - update.sellingPrice) / mrp) * 100) : 0;
      }

      if (update.purchasePrice !== undefined && update.purchasePrice !== null) {
        update.purchasePrice = Math.round(update.purchasePrice);
        update.purchasePercentage = mrp > 0 ? Math.round((update.purchasePrice / mrp) * 100 * 100) / 100 : 0;
      } else if (update.purchasePercentage !== undefined) {
        update.purchasePrice = Math.round(mrp * (update.purchasePercentage / 100));
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
