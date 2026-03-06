import mongoose, { Schema, Document } from 'mongoose';

export interface IHeroBanner extends Document {
  title: string;
  subtitle: string;
  description?: string;
  couponCode?: string;
  ctaText: string;
  ctaLink: string;
  bgColor: string;
  accentColor: string;
  image: string; // Emoji or image URL
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const heroBannerSchema = new Schema<IHeroBanner>(
  {
    title: {
      type: String,
      required: [true, 'Banner title is required'],
      trim: true,
    },
    subtitle: {
      type: String,
      required: [true, 'Banner subtitle is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    ctaText: {
      type: String,
      required: [true, 'CTA text is required'],
      default: 'Shop Now',
      trim: true,
    },
    ctaLink: {
      type: String,
      required: [true, 'CTA link is required'],
      default: '/products',
      trim: true,
    },
    bgColor: {
      type: String,
      required: [true, 'Background color is required'],
      default: '#FFF9F0',
    },
    accentColor: {
      type: String,
      required: [true, 'Accent color is required'],
      default: '#FFE5ED',
    },
    image: {
      type: String,
      required: [true, 'Image/emoji is required'],
      default: '🐾',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
heroBannerSchema.index({ isActive: 1, displayOrder: 1 });

const HeroBanner = mongoose.model<IHeroBanner>('HeroBanner', heroBannerSchema);

export default HeroBanner;
