import mongoose, { Schema } from 'mongoose';
import { ITransaction, TransactionType, PaymentStatus } from '../types';

const transactionSchema = new Schema<ITransaction>(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    customerId: {
      type: String,
      required: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    serviceRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceRequest',
    },
    transactionType: {
      type: String,
      enum: ['express_delivery', 'standard_delivery', 'prime_product', 'bird_dna_service', 'other_service'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    payment_id: {
      type: String,
      required: true,
    },
    payment_gateway: {
      type: String,
      default: 'razorpay',
    },
    payment_status: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
      default: 'Pending',
    },
    description: String,
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ customerId: 1 });
transactionSchema.index({ orderId: 1 });
transactionSchema.index({ serviceRequestId: 1 });
transactionSchema.index({ transactionType: 1 });
transactionSchema.index({ payment_status: 1 });
transactionSchema.index({ createdAt: 1 });

const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);

export default Transaction;

