import mongoose, { Schema } from 'mongoose';
import { IComplaint } from '../types';

const complaintSchema = new Schema<IComplaint>(
  {
    customer_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    order_id: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    subject: {
      type: String,
      required: [true, 'Please provide a subject'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide a description'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved', 'closed'],
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    vendorNotified: {
      type: Boolean,
      default: false,
    },
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolution: {
      type: String,
      trim: true,
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

complaintSchema.index({ customer_id: 1 });
complaintSchema.index({ order_id: 1 });
complaintSchema.index({ vendor_id: 1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ priority: 1 });

const Complaint = mongoose.model<IComplaint>('Complaint', complaintSchema);

export default Complaint;

