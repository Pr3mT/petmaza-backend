import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailLog extends Document {
  recipient: string;
  subject: string;
  body: string;
  status: 'sent' | 'failed';
  trigger: string;
  timestamp: Date;
  messageId?: string;
  error?: string;
  orderId?: string;
  userId?: string;
}

const EmailLogSchema: Schema = new Schema({
  recipient: { type: String, required: true, index: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  status: { type: String, enum: ['sent', 'failed'], required: true, index: true },
  trigger: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  messageId: { type: String },
  error: { type: String },
  orderId: { type: String, index: true },
  userId: { type: String, index: true },
});

export default mongoose.model<IEmailLog>('EmailLog', EmailLogSchema);
