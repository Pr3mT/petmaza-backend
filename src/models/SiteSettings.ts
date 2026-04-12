import mongoose, { Schema, Document } from 'mongoose';

export interface ISiteSettings extends Document {
  birdDnaServiceEnabled: boolean;
  birdDnaPricePerSample: number;
  createdAt: Date;
  updatedAt: Date;
}

const siteSettingsSchema = new Schema<ISiteSettings>(
  {
    birdDnaServiceEnabled: { type: Boolean, default: false },
    birdDnaPricePerSample: { type: Number, default: 300, min: 0 },
  },
  { timestamps: true }
);

const SiteSettings = mongoose.model<ISiteSettings>('SiteSettings', siteSettingsSchema);

export default SiteSettings;
