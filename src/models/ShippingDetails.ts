import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IShippingDetails extends Document {
  order_id: Types.ObjectId;
  vendor_id: Types.ObjectId;
  shipping_company: string;
  receipt_file_url?: string;
  receipt_file_public_id?: string;
  tracking_id: string;
  tracking_link?: string;
  shipping_cost?: number;
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
    tracking_id: {
      type: String,
      required: true,
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
