import mongoose, { Schema } from 'mongoose';
import { IBrand } from '../types';

const brandSchema = new Schema<IBrand>(
  {
    name: {
      type: String,
      required: [true, 'Please provide a brand name'],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
brandSchema.index({ isActive: 1 });

const Brand = mongoose.model<IBrand>('Brand', brandSchema);

export default Brand;

