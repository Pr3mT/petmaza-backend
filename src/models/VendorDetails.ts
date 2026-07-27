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
      enum: ['PRIME', 'MY_SHOP', 'WAREHOUSE_FULFILLER', 'QUICK_SHOP'],
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
    // ── Petmaza Quick dark-store serviceability (QUICK_SHOP only) ─────────────
    // A pincode is far too coarse for 30-minute delivery — 410206 alone spans
    // New Panvel to Kalamboli. A Quick shop instead serves a CIRCLE: everything
    // within `deliveryRadiusKm` of `storeLocation`. Other vendor types keep
    // using serviceablePincodes, which is why that field stays.
    //
    // GeoJSON order is [longitude, latitude] — the opposite of how Google Maps
    // shows it ("lat, lng"). VendorDetails.setStoreLocation() below takes the
    // human order so callers can't get it backwards.
    storeLocation: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: (v: number[]) =>
            !v || v.length === 0 ||
            (v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90),
          message: 'storeLocation.coordinates must be [longitude, latitude] within valid ranges',
        },
      },
    },
    deliveryRadiusKm: {
      type: Number,
      default: 4,
      min: [0.5, 'Delivery radius must be at least 0.5 km'],
      max: [25, 'Delivery radius cannot exceed 25 km'],
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
// 2dsphere indexes are sparse by default, so vendors without a storeLocation
// (every non-Quick vendor, plus Quick shops the admin hasn't located yet) are
// simply absent from the index rather than erroring.
vendorDetailsSchema.index({ storeLocation: '2dsphere' });

const VendorDetails = mongoose.model<IVendorDetails>('VendorDetails', vendorDetailsSchema);

export default VendorDetails;
