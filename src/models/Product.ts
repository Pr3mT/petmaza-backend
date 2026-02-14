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
      required: [true, 'Please provide a category'],
    },
    brand_id: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      required: [true, 'Please provide a brand'],
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
    mrp: {
      type: Number,
      required: [true, 'Please provide an MRP'],
      min: 0,
    },
    sellingPercentage: {
      type: Number,
      required: [true, 'Please provide a selling percentage'],
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
  const mrp = this.get('mrp') as number;
  
  if (mrp && (this.isModified('mrp') || this.isModified('sellingPercentage'))) {
    const sellingPercentage = this.get('sellingPercentage') as number;
    const sellingPrice = mrp * (sellingPercentage / 100);
    this.set('sellingPrice', sellingPrice);
    
    // Auto-calculate discount percentage
    if (mrp > 0) {
      const discount = ((mrp - sellingPrice) / mrp) * 100;
      this.set('discount', Math.round(discount * 100) / 100); // Round to 2 decimal places
    }
  }
  
  if (mrp && (this.isModified('mrp') || this.isModified('purchasePercentage'))) {
    const purchasePercentage = this.get('purchasePercentage') as number;
    this.set('purchasePrice', mrp * (purchasePercentage / 100));
  }
  
  next();
});

// Indexes
productSchema.index({ category_id: 1 });
productSchema.index({ brand_id: 1 });
productSchema.index({ isPrime: 1 });
productSchema.index({ isActive: 1 });

const Product = mongoose.model<IProduct>('Product', productSchema);

export default Product;
