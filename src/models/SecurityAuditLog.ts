import mongoose, { Schema, Document } from 'mongoose';

export interface ISecurityAuditLog extends Document {
  event: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  ipAddress?: string;
  userAgent?: string;
  expected?: any;
  received?: any;
  details: string;
  resolved: boolean;
  createdAt: Date;
}

const securityAuditLogSchema = new Schema<ISecurityAuditLog>(
  {
    event: {
      type: String,
      required: true,
      enum: [
        'PAYMENT_AMOUNT_TAMPERING',
        'CART_PRICE_TAMPERING',
        'PAYMENT_AMOUNT_MISMATCH_POST_PAYMENT',
        'INVALID_PAYMENT_SIGNATURE',
        'UNAUTHORIZED_ORDER_ACCESS',
        'SUSPICIOUS_QUANTITY',
        'PAYMENT_REPLAY_ATTACK',
      ],
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'HIGH',
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    ipAddress: { type: String },
    userAgent: { type: String },
    expected: { type: Schema.Types.Mixed },
    received: { type: Schema.Types.Mixed },
    details: { type: String, required: true },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

securityAuditLogSchema.index({ event: 1, createdAt: -1 });
securityAuditLogSchema.index({ userId: 1, createdAt: -1 });
securityAuditLogSchema.index({ severity: 1, resolved: 1 });
securityAuditLogSchema.index({ orderId: 1 });

const SecurityAuditLog = mongoose.model<ISecurityAuditLog>('SecurityAuditLog', securityAuditLogSchema);

export default SecurityAuditLog;
