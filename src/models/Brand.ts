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
    subcategories: [{
      type: Schema.Types.ObjectId,
      ref: 'Category',
    }],
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
brandSchema.index({ name: 1 }, { unique: true }); // Unique index on name
brandSchema.index({ isActive: 1 });
brandSchema.index({ isActive: 1, name: 1 }); // Compound index
brandSchema.index({ subcategories: 1 }); // Index for subcategory filtering

const Brand = mongoose.model<IBrand>('Brand', brandSchema);

export default Brand;

