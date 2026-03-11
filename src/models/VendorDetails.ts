import mongoose, { Schema } from 'mongoose';
import { IVendorDetails } from '../types';

const vendorDetailsSchema = new Schema<IVendorDetails>(
  {
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    vendorType: {
      type: String,
      enum: ['PRIME', 'MY_SHOP', 'WAREHOUSE_FULFILLER'],
      required: true,
    },
    shopName: {
      type: String,
      required: [true, 'Please provide shop name'],
      trim: true,
    },
    brandsHandled: {
      type: [Schema.Types.ObjectId],
      ref: 'Brand',
      default: [],
    },
    assignedSubcategories: {
      type: [String],
      default: [],
    },
    pickupAddress: {
      street: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      pincode: {
        type: String,
        required: true,
      },
    },
    serviceablePincodes: {
      type: [String],
      default: [],
    },
    panCard: {
      type: String,
      trim: true,
    },
    aadharCard: {
      type: String,
      trim: true,
    },
    bankDetails: {
      accountNumber: {
        type: String,
      },
      ifscCode: {
        type: String,
      },
      bankName: {
        type: String,
      },
      accountHolderName: {
        type: String,
      },
    },
    billingDetails: {
      gstNumber: String,
      billingAddress: String,
    },
    // Prime Vendor specific fields
    businessType: {
      type: String,
      enum: ['MANUFACTURER', 'WHOLESALER', 'DISTRIBUTOR', 'RETAILER'],
    },
    yearsInBusiness: {
      type: Number,
      default: 0,
    },
    averageDeliveryTime: {
      type: String,
      default: '2-5 days',
    },
    returnPolicy: {
      type: String,
      default: '7 days return policy',
    },
    // Vendor Stats
    totalOrders: {
      type: Number,
      default: 0,
    },
    completedOrders: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    // Prime Vendor Stats
    totalPrimeProducts: {
      type: Number,
      default: 0,
    },
    activePrimeProducts: {
      type: Number,
      default: 0,
    },
    totalPrimeSales: {
      type: Number,
      default: 0,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// vendor_id already has unique index, no need for duplicate
vendorDetailsSchema.index({ vendorType: 1 });
vendorDetailsSchema.index({ isApproved: 1 });
vendorDetailsSchema.index({ serviceablePincodes: 1 });

const VendorDetails = mongoose.model<IVendorDetails>('VendorDetails', vendorDetailsSchema);

export default VendorDetails;
