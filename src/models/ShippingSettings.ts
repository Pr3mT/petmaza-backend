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

  // Petmaza Quick — separate delivery & platform fee for Quick (hyperlocal) orders
  quickShippingEnabled: boolean;
  quickFreeShippingThreshold: number; // Quick orders above this amount get free delivery
  quickShippingChargesBelowThreshold: number; // Delivery charge for Quick orders below threshold
  quickPlatformFeeEnabled: boolean;
  quickPlatformFeeThreshold: number; // Quick orders above this amount get platform fee
  quickPlatformFeeAmount: number; // Fixed platform fee for Quick orders

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

    // Petmaza Quick delivery & platform fee configuration.
    // Defaults OFF so Quick stays free/no-fee until admin turns it on.
    quickShippingEnabled: {
      type: Boolean,
      default: false,
      required: true,
    },
    quickFreeShippingThreshold: {
      type: Number,
      default: 199,
      required: true,
      min: 0,
    },
    quickShippingChargesBelowThreshold: {
      type: Number,
      default: 25,
      required: true,
      min: 0,
    },
    quickPlatformFeeEnabled: {
      type: Boolean,
      default: false,
      required: true,
    },
    quickPlatformFeeThreshold: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
    },
    quickPlatformFeeAmount: {
      type: Number,
      default: 5,
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
