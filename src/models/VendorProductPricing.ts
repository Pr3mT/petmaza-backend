import mongoose, { Schema } from 'mongoose';
import { IVendorProductPricing } from '../types';

const vendorProductPricingSchema = new Schema<IVendorProductPricing>(
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
    purchasePercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    purchasePrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    availableStock: {
      type: Number,
      default: 0,
      min: 0,
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
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-calculate purchase price before saving
vendorProductPricingSchema.pre('save', async function (next) {
  if (this.isModified('purchasePercentage')) {
    // Fetch product MRP
    const Product = mongoose.model('Product');
    const productId = this.get('product_id');
    const product = await Product.findById(productId);
    if (product) {
      const mrp = (product as any).mrp as number;
      const purchasePercentage = this.get('purchasePercentage') as number;
      this.set('purchasePrice', mrp * (purchasePercentage / 100));
    }
  }
  next();
});

// Compound index to ensure unique vendor-product combination
vendorProductPricingSchema.index({ vendor_id: 1, product_id: 1 }, { unique: true });
vendorProductPricingSchema.index({ vendor_id: 1 });
vendorProductPricingSchema.index({ product_id: 1 });
vendorProductPricingSchema.index({ isActive: 1 });

const VendorProductPricing = mongoose.model<IVendorProductPricing>(
  'VendorProductPricing',
  vendorProductPricingSchema
);

export default VendorProductPricing;

