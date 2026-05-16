import mongoose, { Schema, Document } from 'mongoose';

export interface ISiteSettings extends Document {
  birdDnaServiceEnabled: boolean;
  birdDnaPricePerSample: number;
  birdDnaPickupCharge: number;
  birdDnaPrintedCardCharge: number;
  createdAt: Date;
  updatedAt: Date;
}

const siteSettingsSchema = new Schema<ISiteSettings>(
  {
    birdDnaServiceEnabled: { type: Boolean, default: false },
    birdDnaPricePerSample: { type: Number, default: 200, min: 0 },
    birdDnaPickupCharge: { type: Number, default: 100, min: 0 },
    birdDnaPrintedCardCharge: { type: Number, default: 100, min: 0 },
  },
  { timestamps: true }
);

const SiteSettings = mongoose.model<ISiteSettings>('SiteSettings', siteSettingsSchema);

export default SiteSettings;
