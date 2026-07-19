import mongoose, { Schema } from 'mongoose';
import { IQuickProductListing } from '../types';

const quickProductListingSchema = new Schema<IQuickProductListing>(
  {
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    product_id: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
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

// Compound index to ensure unique vendor-product combination
quickProductListingSchema.index({ vendor_id: 1, product_id: 1 }, { unique: true });
quickProductListingSchema.index({ product_id: 1 });
quickProductListingSchema.index({ isActive: 1 });

const QuickProductListing = mongoose.model<IQuickProductListing>(
  'QuickProductListing',
  quickProductListingSchema
);

export default QuickProductListing;
