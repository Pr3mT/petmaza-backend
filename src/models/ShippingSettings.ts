import mongoose, { Schema, Document } from 'mongoose';

export interface IShippingSettings extends Document {
  // Shipping charges
  shippingEnabled: boolean;
  freeShippingThreshold: number; // Orders above this amount get free shipping
  shippingChargesBelowThreshold: number; // Charges for orders below threshold
  
  // Platform fee
  platformFeeEnabled: boolean;
  platformFeeThreshold: number; // Orders above this amount get platform fee
  platformFeeAmount: number; // Fixed platform fee amount
  
  // Metadata
  updatedBy?: mongoose.Types.ObjectId; // Admin who made the changes
  createdAt: Date;
  updatedAt: Date;
}

const ShippingSettingsSchema = new Schema<IShippingSettings>(
  {
    // Shipping charges configuration
    shippingEnabled: {
      type: Boolean,
      default: true,
      required: true,
    },
    freeShippingThreshold: {
      type: Number,
      default: 300,
      required: true,
      min: 0,
    },
    shippingChargesBelowThreshold: {
      type: Number,
      default: 50,
      required: true,
      min: 0,
    },
    
    // Platform fee configuration
    platformFeeEnabled: {
      type: Boolean,
      default: true,
      required: true,
    },
    platformFeeThreshold: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
    },
    platformFeeAmount: {
      type: Number,
      default: 10,
      required: true,
      min: 0,
    },
    
    // Metadata
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one settings document exists (singleton pattern)
ShippingSettingsSchema.index({}, { unique: true });

const ShippingSettings = mongoose.model<IShippingSettings>('ShippingSettings', ShippingSettingsSchema);

export default ShippingSettings;
