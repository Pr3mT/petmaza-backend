import mongoose, { Schema, Document } from 'mongoose';

export interface IAd extends Document {
  title: string;
  description?: string;
  image: string;
  link?: string;
  position: 'top' | 'bottom' | 'popup' | 'sidebar';
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  displayOrder: number;
  clickCount: number;
  impressionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const adSchema = new Schema<IAd>(
  {
    title: {
      type: String,
      required: [true, 'Ad title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      required: [true, 'Ad image is required'],
    },
    link: {
      type: String,
      trim: true,
    },
    position: {
      type: String,
      enum: ['top', 'bottom', 'popup', 'sidebar'],
      required: [true, 'Ad position is required'],
      default: 'top',
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    clickCount: {
      type: Number,
      default: 0,
    },
    impressionCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
adSchema.index({ isActive: 1, position: 1, displayOrder: 1 });
adSchema.index({ startDate: 1, endDate: 1 });

const Ad = mongoose.model<IAd>('Ad', adSchema);

export default Ad;
