import mongoose, { Schema, Document } from 'mongoose';

export interface ICategoryFulfillerMapping extends Document {
  mainCategory: string;
  subCategory: string | null;
  fulfiller_id: mongoose.Types.ObjectId;
  fulfillerName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categoryFulfillerMappingSchema = new Schema<ICategoryFulfillerMapping>(
  {
    mainCategory: {
      type: String,
      required: [true, 'mainCategory is required'],
      enum: {
        values: ['Dog', 'Cat', 'Fish', 'Bird', 'Small Animals'],
        message: 'mainCategory must be one of: Dog, Cat, Fish, Bird, Small Animals',
      },
    },
    // null means this mapping applies to ALL subcategories of mainCategory
    // A specific value makes it subcategory-scoped (takes priority over wildcard)
    subCategory: {
      type: String,
      default: null,
      trim: true,
    },
    fulfiller_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'fulfiller_id is required'],
    },
    // Denormalized for quick display without a join
    fulfillerName: {
      type: String,
      required: [true, 'fulfillerName is required'],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound index: fast lookup during bulk upload
categoryFulfillerMappingSchema.index({ mainCategory: 1, subCategory: 1 });
// Prevent duplicate mappings for the same category+subCategory pair
categoryFulfillerMappingSchema.index(
  { mainCategory: 1, subCategory: 1 },
  { unique: true, sparse: true }
);

export default mongoose.model<ICategoryFulfillerMapping>(
  'CategoryFulfillerMapping',
  categoryFulfillerMappingSchema
);
