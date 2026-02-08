import mongoose, { Schema } from 'mongoose';
import { IWallet } from '../types';

const walletSchema = new Schema<IWallet>(
  {
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastBillingDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

walletSchema.index({ vendor_id: 1 });

const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);

export default Wallet;

