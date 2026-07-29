/**
 * shippingDetails.ts
 *
 * Recovery for a shipping submission that was left half-done.
 *
 * Every addShippingDetails path writes the ShippingDetails record BEFORE saving
 * the order, and there is no transaction — a failure between the two leaves the
 * record on file with the order still at PACKED. The panels then keep offering
 * "Add Shipping Details" (they pick the action from order.status), and every
 * retry fails with 409, because order_id is unique on ShippingDetails. That is a
 * dead end for a vendor: only an admin can force the status forward.
 *
 * Same trap when an order that already shipped is pushed back to PACKED.
 *
 * So instead of 409-ing on a record that exists while the order never moved,
 * finish the transition the first attempt started.
 */

/**
 * Advance an order whose shipping record exists but whose status never left
 * `from`, copying courier & tracking off the saved record.
 *
 * Returns false when the order has already moved on — that is a genuine
 * duplicate submission and the caller should still reject it.
 */
export const reconcileStuckShipping = async (
  order: any,
  existing: any,
  { from, to }: { from: string; to: string }
): Promise<boolean> => {
  if (String(order.status) !== from) return false;

  if (!order.courier) order.courier = {};
  order.courier.name = existing.shipping_company;
  order.courier.tracking_id = existing.tracking_id;
  if (existing.tracking_link) order.courier.tracking_link = existing.tracking_link;

  order.status = to;
  await order.save();
  return true;
};
