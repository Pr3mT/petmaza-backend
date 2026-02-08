import mongoose, { Schema } from 'mongoose';
import { IServiceRequest, PaymentStatus } from '../types';

const addressSchema = new Schema(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  { _id: false }
);

const birdSchema = new Schema(
  {
    ringId: { type: String, required: true },
    species: { type: String, required: true },
    collectionDateTime: { type: Date, required: true },
    notes: String,
  },
  { _id: false }
);

const serviceRequestSchema = new Schema<IServiceRequest>(
  {
    customerId: {
      type: String,
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
      enum: ['pending', 'pickup_scheduled', 'picked_up', 'delivered', 'completed'],
      default: 'pending',
    },
    pickupRequestId: String,
    payment_id: String,
    payment_status: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
      default: 'Pending',
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

serviceRequestSchema.index({ customerId: 1 });
serviceRequestSchema.index({ status: 1 });

const ServiceRequest = mongoose.model<IServiceRequest>('ServiceRequest', serviceRequestSchema);

export default ServiceRequest;

