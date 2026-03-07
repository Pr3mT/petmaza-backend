import mongoose, { Schema, Document } from 'mongoose';

export interface IHeroBanner extends Document {
  bannerType: 'text' | 'image'; // 'text' for text-based banners, 'image' for full carousel images
  title: string;
  subtitle: string;
  description?: string;
  couponCode?: string;
  ctaText: string;
  ctaLink: string;
  bgColor: string;
  accentColor: string;
  image: string; // Emoji or image URL (for text type) or full carousel image URL (for image type)
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const heroBannerSchema = new Schema<IHeroBanner>(
  {
    bannerType: {
      type: String,
      enum: ['text', 'image'],
      default: 'text',
      required: true,
    },
    title: {
      type: String,
      required: function(this: IHeroBanner) {
        return this.bannerType === 'text';
      },
      trim: true,
    },
    subtitle: {
      type: String,
      required: function(this: IHeroBanner) {
        return this.bannerType === 'text';
      },
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
      required: function(this: IHeroBanner) {
        return this.bannerType === 'text';
      },
      default: 'Shop Now',
      trim: true,
    },
    ctaLink: {
      type: String,
      trim: true,
      default: '/products',
    },
    bgColor: {
      type: String,
      default: '#FFF9F0',
    },
    accentColor: {
      type: String,
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
