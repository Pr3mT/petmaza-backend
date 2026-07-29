import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * VendorPayout — one settled payout for ONE vendor on ONE order.
 *
 * Vendors are paid daily on an order basis, so the order (per vendor) is the
 * unit of payment, not the week. Pending payouts are DERIVED live from orders by
 * VendorPayoutService; a document is written here only when an admin actually
 * pays, freezing the amounts at that moment so a later price edit or courier
 * correction can never rewrite what was already handed over.
 *
 * The unique (order_id, vendor_id) index is the double-payment guard: whichever
 * screen marks it paid first wins, and the other sees it as already settled.
 */

export interface IVendorPayoutItem {
  product_id?: Types.ObjectId;
  productName: string;
  quantity: number;
  purchasePrice: number;
  purchaseSubtotal: number;
}

export interface IVendorPayout extends Document {
  order_id: Types.ObjectId;
  vendor_id: Types.ObjectId;
  items: IVendorPayoutItem[];
  productAmount: number;
  shippingArrangedBy: 'VENDOR' | 'PLATFORM' | null;
  shippingCost: number;
  shippingReimbursement: number;
  totalAmount: number;
  /** The day this order became payable (shipped date) — what it was listed under. */
  payableDate: Date;
  status: 'paid';
  paidAt: Date;
  paidBy: Types.ObjectId;
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
}

const vendorPayoutItemSchema = new Schema<IVendorPayoutItem>(
  {
    product_id: { type: Schema.Types.ObjectId },
    productName: { type: String, default: 'Unknown Product' },
    quantity: { type: Number, default: 1, min: 0 },
    purchasePrice: { type: Number, default: 0, min: 0 },
    purchaseSubtotal: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const vendorPayoutSchema = new Schema<IVendorPayout>(
  {
    order_id: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Product-wise snapshot: exactly the lines this vendor was paid for.
    items: { type: [vendorPayoutItemSchema], default: [] },
    productAmount: { type: Number, required: true, min: 0 },
    shippingArrangedBy: {
      type: String,
      enum: ['VENDOR', 'PLATFORM', null],
      default: null,
    },
    shippingCost: { type: Number, default: 0, min: 0 },
    // 0 whenever an admin arranged the courier — Petmaza already paid it.
    shippingReimbursement: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    payableDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['paid'],
      default: 'paid',
      required: true,
    },
    paidAt: { type: Date, required: true },
    paidBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    paymentMethod: { type: String },
    paymentReference: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

// One payout per vendor per order — the double-pay guard.
vendorPayoutSchema.index({ order_id: 1, vendor_id: 1 }, { unique: true });
vendorPayoutSchema.index({ vendor_id: 1, payableDate: -1 });
vendorPayoutSchema.index({ payableDate: -1 });
vendorPayoutSchema.index({ paidAt: -1 });

const VendorPayout = mongoose.model<IVendorPayout>('VendorPayout', vendorPayoutSchema);

export default VendorPayout;
