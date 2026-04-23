/**
 * OrderWorkers.ts
 *
 * Background event workers for post-order processing.
 * Registered once on server start; executed asynchronously after the API
 * has already responded to the customer.  This keeps /api/orders response
 * times under ~200 ms regardless of email/sales latency.
 *
 * Events handled:
 *  order:created        → customer confirmation + admin notification emails
 *  order:vendor-notify  → vendor / fulfiller notification emails
 *  order:record-sales   → sales recording for MY_SHOP orders
 *  order:record-coupon  → coupon usage increment
 */

import {
  orderQueue,
  OrderCreatedPayload,
  VendorNotificationData,
  SalesRecordData,
  RecordCouponPayload,
} from './OrderQueue';
import {
  sendOrderConfirmationEmail,
  sendVendorOrderNotificationEmail,
  sendAdminOrderNotificationEmail,
} from './emailer';
import Order from '../models/Order';
import User from '../models/User';
import Coupon from '../models/Coupon';
import { Types } from 'mongoose';
import logger from '../config/logger';

// ── Worker: Customer confirmation + admin notification emails ─────────────────
orderQueue.on('order:created', async (payload: OrderCreatedPayload) => {
  const {
    userEmail,
    userName,
    orderIds,
    isSplitShipment,
    combinedSubtotal,
    shippingCharges,
    platformFee,
    discountAmount,
    couponCode,
    customerAddress,
    adminEmails,
    totalAmount,
  } = payload;

  // Populate product details for the email here (not in the critical API path)
  try {
    const orders = await Promise.all(
      orderIds.map((id) => Order.findById(id).populate('items.product_id').lean())
    );
    const allItems = orders.flatMap((o: any) => o?.items ?? []);
    const firstOrderLabel = `#${orderIds[0].slice(-8)}${
      isSplitShipment ? ` (+${orderIds.length - 1} more)` : ''
    }`;

    await sendOrderConfirmationEmail(userEmail, userName, firstOrderLabel, {
      totalAmount,
      items: allItems,
      customerAddress,
      shippingCharges,
      platformFee,
      subtotal: combinedSubtotal,
      subtotalBeforeCharges: combinedSubtotal,
      discountAmount: discountAmount ?? 0,
      couponCode: couponCode ?? undefined,
      isSplitShipment,
      splitOrderCount: orderIds.length,
      splitOrderIds: orderIds.map((id) => `#${id.slice(-8)}`),
    });
    logger.info(`[OrderWorkers] ✅ Customer confirmation email sent → ${userEmail}`);
  } catch (err: any) {
    logger.error(`[OrderWorkers] ❌ Customer email failed: ${err.message}`);
  }

  // Admin notifications
  for (const adminEmail of adminEmails) {
    try {
      await sendAdminOrderNotificationEmail(adminEmail, `#${orderIds[0].slice(-8)}`, {
        customerName: userName,
        totalAmount,
        items: [],
      });
    } catch (err: any) {
      logger.error(`[OrderWorkers] ❌ Admin email to ${adminEmail} failed: ${err.message}`);
    }
  }
});

// ── Worker: Vendor / fulfiller notification emails ────────────────────────────
orderQueue.on('order:vendor-notify', async (payload: VendorNotificationData) => {
  const {
    orderId,
    customerId,
    vendorIds,
    orderItems,
    orderTotal,
    customerAddress,
    customerPincode,
    isBroadcast,
    isCompetitive,
    competitorCount,
    acceptanceDeadline,
  } = payload;

  try {
    // Batch-fetch customer + all vendors in parallel
    const [customer, ...vendors] = await Promise.all([
      User.findById(customerId).select('name').lean(),
      ...vendorIds.map((vid) => User.findById(vid).select('name email').lean()),
    ]);
    const customerName = (customer as any)?.name ?? 'Customer';

    await Promise.all(
      vendors.map(async (vendor: any) => {
        if (!vendor?.email) return;
        try {
          await sendVendorOrderNotificationEmail(
            vendor.email,
            vendor.name ?? 'Vendor',
            `#${orderId.slice(-8)}`,
            {
              customerName,
              totalAmount: orderTotal,
              customerAddress,
              customerPincode,
              items: orderItems,
              ...(isBroadcast
                ? { isCompetitive, competitorCount, acceptanceDeadline }
                : {}),
            }
          );
          logger.info(`[OrderWorkers] 📧 Vendor notified: ${vendor.email}`);
        } catch (e: any) {
          logger.error(`[OrderWorkers] ❌ Vendor email to ${vendor.email} failed: ${e.message}`);
        }
      })
    );
  } catch (err: any) {
    logger.error(`[OrderWorkers] ❌ Vendor notify failed for order ${orderId}: ${err.message}`);
  }
});

// ── Worker: MY_SHOP sales recording ──────────────────────────────────────────
orderQueue.on('order:record-sales', async (payload: SalesRecordData) => {
  const { orderId, vendorId, customerId, items } = payload;
  try {
    const { SalesService } = await import('./SalesService');
    await Promise.all(
      items.map((item: any) =>
        SalesService.recordSale({
          vendor_id: vendorId,
          product_id: item.product_id.toString(),
          quantity: item.quantity,
          saleType: 'WEBSITE',
          soldBy: vendorId,
          order_id: orderId,
          sellingPrice: item.sellingPrice,
          selectedVariant: item.selectedVariant,
        }).catch((e: any) =>
          logger.error(
            `[OrderWorkers] recordSale failed for product ${item.product_id}: ${e.message}`
          )
        )
      )
    );
    logger.info(`[OrderWorkers] ✅ Sales recorded for order ${orderId}`);
  } catch (err: any) {
    logger.error(`[OrderWorkers] ❌ Record sales failed for order ${orderId}: ${err.message}`);
  }
});

// ── Worker: Coupon usage recording ───────────────────────────────────────────
orderQueue.on('order:record-coupon', async (payload: RecordCouponPayload) => {
  const { couponId, userId, couponCode } = payload;
  try {
    const coupon = await Coupon.findById(couponId);
    if (!coupon) return;

    coupon.usedCount += 1;
    const existing = coupon.usedBy.find(
      (u: any) => u.user_id.toString() === userId
    );
    if (existing) {
      existing.usageCount += 1;
      existing.lastUsedAt = new Date();
    } else {
      coupon.usedBy.push({ user_id: new Types.ObjectId(userId), usageCount: 1, lastUsedAt: new Date() });
    }
    await coupon.save();
    logger.info(`[OrderWorkers] ✅ Coupon usage recorded: ${couponCode}`);
  } catch (err: any) {
    logger.error(`[OrderWorkers] ❌ Record coupon failed (${couponCode}): ${err.message}`);
  }
});

logger.info('[OrderWorkers] All background workers registered');
