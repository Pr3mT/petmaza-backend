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
      enum: ['PRIME', 'MY_SHOP'],
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

vendorDetailsSchema.index({ vendor_id: 1 });
vendorDetailsSchema.index({ vendorType: 1 });
vendorDetailsSchema.index({ isApproved: 1 });
vendorDetailsSchema.index({ serviceablePincodes: 1 });

const VendorDetails = mongoose.model<IVendorDetails>('VendorDetails', vendorDetailsSchema);

export default VendorDetails;
