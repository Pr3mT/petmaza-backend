import mongoose, { Schema } from 'mongoose';

export interface ISalesHistory extends mongoose.Document {
  vendor_id: mongoose.Types.ObjectId;
  product_id: mongoose.Types.ObjectId;
  quantity: number;
  purchasePrice: number; // Price vendor paid per unit
  totalPurchasePrice: number; // Total cost for this sale
  sellingPrice?: number; // Price customer paid per unit (null for store sales)
  totalSellingPrice?: number; // Total revenue (null for store sales)
  profit?: number; // Profit earned (null for store sales)
  saleType: 'WEBSITE' | 'STORE'; // Where the sale happened
  order_id?: mongoose.Types.ObjectId; // Reference to order (for website sales)
  soldBy: mongoose.Types.ObjectId; // Admin user who recorded the sale
  notes?: string; // Optional notes (for store sales)
  saleDate: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const salesHistorySchema = new Schema<ISalesHistory>(
  {
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    product_id: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPurchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      min: 0,
    },
    totalSellingPrice: {
      type: Number,
      min: 0,
    },
    profit: {
      type: Number,
    },
    saleType: {
      type: String,
      enum: ['WEBSITE', 'STORE'],
      required: true,
      index: true,
    },
    order_id: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    soldBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    saleDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
salesHistorySchema.index({ vendor_id: 1, saleDate: -1 });
salesHistorySchema.index({ vendor_id: 1, product_id: 1, saleDate: -1 });
salesHistorySchema.index({ saleType: 1, saleDate: -1 });
salesHistorySchema.index({ order_id: 1 });

const SalesHistory = mongoose.model<ISalesHistory>(
  'SalesHistory',
  salesHistorySchema
);

export default SalesHistory;
