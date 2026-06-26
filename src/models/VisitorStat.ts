import mongoose, { Schema, Document } from 'mongoose';

export interface IVisitorStat extends Document {
  date: string; // YYYY-MM-DD in IST — one document per day
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

const visitorStatSchema = new Schema<IVisitorStat>(
  {
    date: { type: String, required: true, unique: true },
    count: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

const VisitorStat = mongoose.model<IVisitorStat>('VisitorStat', visitorStatSchema);

export default VisitorStat;
