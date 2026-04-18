import mongoose, { Schema } from 'mongoose';
import { IPrimeProduct } from '../types';

const primeProductSchema = new Schema<IPrimeProduct>(
  {
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    product_id: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    vendorPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    vendorMRP: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    minOrderQuantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    maxOrderQuantity: {
      type: Number,
      default: 100,
      min: 1,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deliveryTime: {
      type: String,
      default: '3-5 business days',
    },
    deliveryNotes: {
      type: String,
      trim: true,
    },
    vendorDescription: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    vendorImages: {
      type: [String],
      default: [],
      validate: {
        validator: (images: string[]) => images.length <= 5,
        message: 'Maximum 5 vendor images allowed',
      },
    },
    selectedVariant: {
      weight: { type: Number },
      unit: { type: String },
      size: { type: String },
      displayWeight: { type: String },
    },
    purchasePrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },
    ordersCount: {
      type: Number,
      default: 0,
    },
    soldQuantity: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index - one vendor can list one product only once
primeProductSchema.index({ vendor_id: 1, product_id: 1 }, { unique: true });
primeProductSchema.index({ product_id: 1, isActive: 1, isAvailable: 1 });
primeProductSchema.index({ vendor_id: 1, isActive: 1 });

const PrimeProduct = mongoose.model<IPrimeProduct>('PrimeProduct', primeProductSchema);

export default PrimeProduct;
