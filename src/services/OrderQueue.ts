import EventEmitter from 'events';
import logger from '../config/logger';

// ── Payload types shared between routing service and background workers ────────

export interface VendorNotificationData {
  orderId: string;
  customerId: string;
  vendorIds: string[];         // prime: [vendorId]  /  warehouse broadcast: [id1, id2, ...]
  orderItems: any[];
  orderTotal: number;
  customerAddress: any;
  customerPincode: string;
  isBroadcast: boolean;
  isCompetitive?: boolean;
  competitorCount?: number;
  acceptanceDeadline?: string;
}

export interface SalesRecordData {
  orderId: string;
  vendorId: string;
  customerId: string;
  items: any[];
}

export interface OrderCreatedPayload {
  userEmail: string;
  userName: string;
  userId: string;
  orderIds: string[];
  isSplitShipment: boolean;
  combinedSubtotal: number;
  shippingCharges: number;
  platformFee: number;
  discountAmount: number;
  couponCode?: string;
  customerAddress: any;
  adminEmails: string[];
  totalAmount: number;
}

export interface RecordCouponPayload {
  couponId: string;
  userId: string;
  couponCode: string;
}

// ── Typed event map ───────────────────────────────────────────────────────────

type OrderEventMap = {
  'order:created': OrderCreatedPayload;
  'order:vendor-notify': VendorNotificationData;
  'order:record-sales': SalesRecordData;
  'order:record-coupon': RecordCouponPayload;
};

// ── Typed EventEmitter wrapper ────────────────────────────────────────────────

class OrderQueueEmitter extends EventEmitter {
  emit<K extends keyof OrderEventMap>(event: K, payload: OrderEventMap[K]): boolean {
    return super.emit(event as string, payload);
  }

  on<K extends keyof OrderEventMap>(
    event: K,
    listener: (payload: OrderEventMap[K]) => void
  ): this {
    return super.on(event as string, listener);
  }
}

export const orderQueue = new OrderQueueEmitter();
orderQueue.setMaxListeners(20);

logger.info('[OrderQueue] Event-driven order processing queue initialized');
