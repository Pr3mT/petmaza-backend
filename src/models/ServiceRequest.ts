import mongoose, { Schema } from 'mongoose';
import { IServiceRequest } from '../types';

const addressSchema = new Schema(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  { _id: false }
);

const labReportSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String },
    note: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: String, required: true },
  },
  { _id: false }
);

const birdSchema = new Schema(
  {
    birdName: { type: String },
    bandId: { type: String, required: true },
    species: { type: String, required: true },
    collectionDateTime: { type: Date, required: true },
    notes: String,
    labReports: {
      type: [labReportSchema],
      default: [],
    },
  },
  { _id: false }
);

const serviceRequestSchema = new Schema<IServiceRequest>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    serviceType: {
      type: String,
      enum: ['bird_dna'],
      default: 'bird_dna',
    },
    customerName: {
      type: String,
      required: true,
    },
    farm: {
      type: String,
      required: true,
    },
    address: {
      type: addressSchema,
      required: true,
    },
    birds: {
      type: [birdSchema],
      required: true,
      validate: {
        validator: (birds: any[]) => birds.length > 0,
        message: 'At least one bird is required',
      },
    },
    pickupAddress: {
      type: addressSchema,
      required: true,
    },
    deliveryAddress: {
      type: addressSchema,
      required: true,
    },
    extraNote: String,
    status: {
      type: String,
      enum: ['pending', 'accepted', 'sample_collected', 'testing', 'completed', 'cancelled'],
      default: 'pending',
    },
    pickupRequestId: String,
    payment_id: String,
    payment_status: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
      default: 'Pending',
    },
    pricePerSample: {
      type: Number,
      default: 300,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    // Legacy request-level reports retained for backward compatibility with existing data.
    labReports: {
      type: [labReportSchema],
      default: [],
    },
    vendorAssignedId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

serviceRequestSchema.index({ customerId: 1 });
serviceRequestSchema.index({ status: 1 });
serviceRequestSchema.index({ vendorAssignedId: 1 });

const ServiceRequest = mongoose.model<IServiceRequest>('ServiceRequest', serviceRequestSchema);

export default ServiceRequest;

