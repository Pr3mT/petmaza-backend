import mongoose, { Schema } from 'mongoose';
import { IBilling } from '../types';

const billingSchema = new Schema<IBilling>(
  {
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    } as any,
    weekStart: {
      type: Date,
      required: true,
    },
    weekEnd: {
      type: Date,
      required: true,
    },
    orders: {
      type: [Schema.Types.ObjectId],
      ref: 'Order',
      default: [],
    } as any,
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending',
    },
    paidAt: {
      type: Date,
    },
    paidBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    paymentMethod: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

billingSchema.index({ vendor_id: 1 });
billingSchema.index({ weekStart: 1, weekEnd: 1 });
billingSchema.index({ status: 1 });

const Billing = mongoose.model<IBilling>('Billing', billingSchema);

export default Billing;

