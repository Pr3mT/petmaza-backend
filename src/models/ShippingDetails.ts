import mongoose, { Schema, Document, Types } from 'mongoose';

// Who actually booked and paid the courier. Drives vendor billing: a VENDOR
// shipment is reimbursed on top of the product price, a PLATFORM shipment is
// Petmaza's own cost and the vendor is paid product price only.
export type ShippingArrangedBy = 'VENDOR' | 'PLATFORM';

export interface IShippingDetails extends Document {
  order_id: Types.ObjectId;
  vendor_id: Types.ObjectId;
  shipping_company: string;
  receipt_file_url?: string;
  receipt_file_public_id?: string;
  tracking_id?: string;
  tracking_link?: string;
  shipping_cost?: number;
  shipping_arranged_by: ShippingArrangedBy;
  arranged_by_user_id?: Types.ObjectId;
  total_weight?: number;
  weight_unit?: 'kg' | 'g';
  delivery_type?: 'inter_state' | 'out_of_state';
  created_at: Date;
}

const shippingDetailsSchema = new Schema<IShippingDetails>(
  {
    order_id: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
    },
    vendor_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shipping_company: {
      type: String,
      required: true,
      trim: true,
    },
    receipt_file_url: {
      type: String,
    },
    receipt_file_public_id: {
      type: String,
    },
    // Courier shipments always carry one and every courier-side controller
    // rejects a submission without it. Petmaza Quick is a local hand-off to a
    // delivery partner who has no tracking number at all, so the requirement
    // lives in the controllers rather than here.
    tracking_id: {
      type: String,
      trim: true,
    },
    tracking_link: {
      type: String,
      trim: true,
    },
    shipping_cost: {
      type: Number,
      min: 0,
    },
    // Stamped from the panel that filed the record — vendor/fulfiller/shop
    // endpoints write VENDOR, the admin endpoint writes PLATFORM. Records
    // created before vendor-side shipping billing existed default to VENDOR,
    // which is what they were: the vendor's own courier.
    shipping_arranged_by: {
      type: String,
      enum: ['VENDOR', 'PLATFORM'],
      default: 'VENDOR',
      required: true,
    },
    arranged_by_user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    total_weight: {
      type: Number,
      min: 0.001,
    },
    weight_unit: {
      type: String,
      enum: ['kg', 'g'],
    },
    delivery_type: {
      type: String,
      enum: ['inter_state', 'out_of_state'],
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

export default mongoose.model<IShippingDetails>('ShippingDetails', shippingDetailsSchema);
