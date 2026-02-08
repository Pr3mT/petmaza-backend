import mongoose, { Schema } from 'mongoose';
import { Document, Types } from 'mongoose';

export interface IAnswer {
  answeredBy: Types.ObjectId | string;
  answerText: string;
  isVendorAnswer: boolean;
  helpfulCount: number;
  createdAt: Date;
}

export interface IProductQuestion extends Document {
  product_id: Types.ObjectId | string;
  customer_id: Types.ObjectId | string;
  questionText: string;
  answers: IAnswer[];
  status: 'pending' | 'answered' | 'closed';
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const answerSchema = new Schema<IAnswer>(
  {
    answeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    answerText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    isVendorAnswer: {
      type: Boolean,
      default: false,
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const productQuestionSchema = new Schema<IProductQuestion>(
  {
    product_id: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    customer_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    answers: {
      type: [answerSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['pending', 'answered', 'closed'],
      default: 'pending',
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
productQuestionSchema.index({ product_id: 1 });
productQuestionSchema.index({ customer_id: 1 });
productQuestionSchema.index({ status: 1 });
productQuestionSchema.index({ createdAt: -1 });
productQuestionSchema.index({ product_id: 1, status: 1, createdAt: -1 });

const ProductQuestion = mongoose.model<IProductQuestion>('ProductQuestion', productQuestionSchema);

export default ProductQuestion;
