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
  },
  {
    timestamps: true,
  }
);

// Auto-calculate selling price, discount, and purchase price before saving
productSchema.pre('save', function (next) {
  // Handle variants
  if (this.hasVariants && this.variants && this.variants.length > 0) {
    this.variants.forEach((variant: any) => {
      const mrp = variant.mrp;
      
      if (mrp && variant.sellingPercentage !== undefined) {
        variant.sellingPrice = mrp * (variant.sellingPercentage / 100);
        
        // Auto-calculate discount percentage
        if (mrp > 0) {
          variant.discount = Math.round(((mrp - variant.sellingPrice) / mrp) * 100 * 100) / 100;
        }
      }
      
      if (mrp && variant.purchasePercentage !== undefined) {
        variant.purchasePrice = mrp * (variant.purchasePercentage / 100);
      }
    });
  }
  
  // Handle single product (no variants)
  const mrp = this.get('mrp') as number;
  
  // For Prime products: calculate sellingPercentage from mrp and sellingPrice
  if (this.isPrime && mrp && this.get('sellingPrice') && !this.hasVariants) {
    const sellingPrice = this.get('sellingPrice') as number;
    if (mrp > 0) {
      const sellingPercentage = (sellingPrice / mrp) * 100;
      this.set('sellingPercentage', Math.round(sellingPercentage * 100) / 100);
      
      // Auto-calculate discount percentage
      const discount = ((mrp - sellingPrice) / mrp) * 100;
      this.set('discount', Math.round(discount * 100) / 100);
    }
  }
  // For non-Prime products: calculate sellingPrice from mrp and sellingPercentage
  else if (mrp && !this.hasVariants && (this.isModified('mrp') || this.isModified('sellingPercentage'))) {
    const sellingPercentage = this.get('sellingPercentage') as number;
    const sellingPrice = mrp * (sellingPercentage / 100);
    this.set('sellingPrice', sellingPrice);
    
    // Auto-calculate discount percentage
    if (mrp > 0) {
      const discount = ((mrp - sellingPrice) / mrp) * 100;
      this.set('discount', Math.round(discount * 100) / 100); // Round to 2 decimal places
    }
  }
  
  if (mrp && !this.hasVariants && (this.isModified('mrp') || this.isModified('purchasePercentage'))) {
    const purchasePercentage = this.get('purchasePercentage') as number;
    this.set('purchasePrice', mrp * (purchasePercentage / 100));
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
        if (variant.mrp && variant.sellingPercentage !== undefined) {
          variant.sellingPrice = variant.mrp * (variant.sellingPercentage / 100);
          variant.discount = Math.round(((variant.mrp - variant.sellingPrice) / variant.mrp) * 100 * 100) / 100;
        }
        if (variant.mrp && variant.purchasePercentage !== undefined) {
          variant.purchasePrice = variant.mrp * (variant.purchasePercentage / 100);
        }
        return variant;
      });
    }
  } else if (update.mrp !== undefined || update.sellingPercentage !== undefined) {
    // Handle single products (no variants)
    // Only calculate if both mrp and sellingPercentage exist
    const mrp = update.mrp;
    const sellingPercentage = update.sellingPercentage;
    
    if (mrp && sellingPercentage !== undefined) {
      update.sellingPrice = mrp * (sellingPercentage / 100);
      update.discount = Math.round(((mrp - update.sellingPrice) / mrp) * 100 * 100) / 100;
    }
    
    if (mrp && update.purchasePercentage !== undefined) {
      update.purchasePrice = mrp * (update.purchasePercentage / 100);
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
