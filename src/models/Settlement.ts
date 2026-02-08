import mongoose, { Schema } from 'mongoose';
import { ISettlement } from '../types';

const settlementSchema = new Schema<ISettlement>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    weekStart: {
      type: Date,
      required: true,
    },
    orders: {
      type: [Schema.Types.ObjectId],
      ref: 'Order',
      default: [],
    },
    totalDue: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'processed', 'paid'],
      default: 'pending',
    },
    processedAt: Date,
  },
  {
    timestamps: true,
  }
);

settlementSchema.index({ vendorId: 1 });
settlementSchema.index({ weekStart: 1 });
settlementSchema.index({ status: 1 });
settlementSchema.index({ vendorId: 1, weekStart: 1 }, { unique: true });

const Settlement = mongoose.model<ISettlement>('Settlement', settlementSchema);

export default Settlement;

