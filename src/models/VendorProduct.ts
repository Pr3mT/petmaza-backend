import mongoose, { Schema } from 'mongoose';
import { IVendorProduct } from '../types';

const vendorProductSchema = new Schema<IVendorProduct>(
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
    warehouse_cost: {
      type: Number,
      required: true,
      min: 0,
    },
    shop_cost: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure unique vendor-product combination
vendorProductSchema.index({ vendor_id: 1, product_id: 1 }, { unique: true });
vendorProductSchema.index({ vendor_id: 1 });
vendorProductSchema.index({ product_id: 1 });
vendorProductSchema.index({ status: 1 });

const VendorProduct = mongoose.model<IVendorProduct>('VendorProduct', vendorProductSchema);

export default VendorProduct;

export default VendorProduct;

