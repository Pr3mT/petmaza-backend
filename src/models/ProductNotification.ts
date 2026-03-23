import mongoose, { Schema, Document } from 'mongoose';

export interface IProductNotification extends Document {
  product_id: mongoose.Types.ObjectId;
  email: string;
  phone?: string;
  name?: string;
  isNotified: boolean;
  createdAt: Date;
  notifiedAt?: Date;
}

const productNotificationSchema = new Schema<IProductNotification>(
  {
    product_id: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    isNotified: {
      type: Boolean,
      default: false,
    },
    notifiedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate notifications
productNotificationSchema.index({ product_id: 1, email: 1 }, { unique: true });

const ProductNotification = mongoose.model<IProductNotification>('ProductNotification', productNotificationSchema);

export default ProductNotification;
