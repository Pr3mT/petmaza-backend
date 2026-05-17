import mongoose, { Schema, Document } from 'mongoose';

export type AnimalCategory = 'Dog' | 'Cat' | 'Bird' | 'Fish' | 'SmallAnimal';

export interface IAnimalAd extends Document {
  mainCategory: AnimalCategory;
  image: string;          // Desktop image URL (required)
  mobileImage?: string;   // Optional mobile-specific image
  ctaLink: string;        // Where the ad navigates on click
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const animalAdSchema = new Schema<IAnimalAd>(
  {
    mainCategory: {
      type: String,
      enum: ['Dog', 'Cat', 'Bird', 'Fish', 'SmallAnimal'],
      required: [true, 'mainCategory is required'],
      index: true,
    },
    image: {
      type: String,
      required: [true, 'Desktop image is required'],
      trim: true,
    },
    mobileImage: {
      type: String,
      required: false,
      default: '',
      trim: true,
    },
    ctaLink: {
      type: String,
      required: [true, 'ctaLink is required'],
      trim: true,
      default: '/products',
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: false },
    toObject: { virtuals: false },
  }
);

// Fast lookup of active ads per category, ordered by displayOrder
animalAdSchema.index({ mainCategory: 1, isActive: 1, displayOrder: 1 });

const AnimalAd = mongoose.model<IAnimalAd>('AnimalAd', animalAdSchema);

export default AnimalAd;
