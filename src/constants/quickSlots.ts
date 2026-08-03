// Petmaza Quick delivers in fixed daily windows rather than "as fast as we can".
// The customer books a window at checkout; the shop admin then confirms it (or
// moves it to a window they can actually hit) on the order, and that confirmed
// window is what the customer is promised.
//
// Both the app and this file must agree on the keys — the mirror lives at
// petmaza/src/constants/quickSlots.js.

export const QUICK_SLOT_KEYS = ['SLOT_10_11', 'SLOT_16_17', 'SLOT_21_22'] as const;

export type QuickSlotKey = (typeof QUICK_SLOT_KEYS)[number];

export interface QuickSlot {
  key: QuickSlotKey;
  label: string; // full form, for emails and detail screens
  short: string; // pill/badge form
  startHour: number; // IST, 24h
  endHour: number;
}

export const QUICK_SLOTS: QuickSlot[] = [
  { key: 'SLOT_10_11', label: '10:00 AM – 11:00 AM', short: '10–11 AM', startHour: 10, endHour: 11 },
  { key: 'SLOT_16_17', label: '4:00 PM – 5:00 PM', short: '4–5 PM', startHour: 16, endHour: 17 },
  { key: 'SLOT_21_22', label: '9:00 PM – 10:00 PM', short: '9–10 PM', startHour: 21, endHour: 22 },
];

const SLOT_BY_KEY = new Map(QUICK_SLOTS.map((s) => [s.key, s]));

export const isQuickSlot = (key: any): key is QuickSlotKey => SLOT_BY_KEY.has(key);

export const quickSlotOf = (key: any): QuickSlot | undefined => SLOT_BY_KEY.get(key);

export const quickSlotLabel = (key: any): string => SLOT_BY_KEY.get(key)?.label || 'Delivery slot';

export const quickSlotShort = (key: any): string => SLOT_BY_KEY.get(key)?.short || 'Slot';

// Slots are wall-clock IST regardless of where the server runs, so do the date
// maths on an IST-shifted instant read through the UTC getters.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// A window is only bookable for today if it hasn't (nearly) started — the shop
// still needs time to pack. Anything later rolls to tomorrow rather than being
// refused, so a customer ordering at 11 PM is never stuck with no slot at all.
const LEAD_MINUTES = 30;

// The instant a slot starts on the IST calendar day `dayOffset` days from `now`.
export const quickSlotStart = (key: QuickSlotKey, now: Date = new Date(), dayOffset = 0): Date => {
  const slot = SLOT_BY_KEY.get(key);
  if (!slot) throw new Error(`Unknown Quick delivery slot: ${key}`);
  const wall = new Date(now.getTime() + IST_OFFSET_MS);
  const startWallMs = Date.UTC(
    wall.getUTCFullYear(),
    wall.getUTCMonth(),
    wall.getUTCDate() + dayOffset,
    slot.startHour
  );
  return new Date(startWallMs - IST_OFFSET_MS);
};

// Earliest day this slot can still be honoured — today, else tomorrow.
export const resolveQuickSlotDate = (key: QuickSlotKey, now: Date = new Date()): Date => {
  const today = quickSlotStart(key, now, 0);
  return today.getTime() - now.getTime() >= LEAD_MINUTES * 60_000 ? today : quickSlotStart(key, now, 1);
};

// "10:00 AM – 11:00 AM, Mon 4 Aug" — used in customer emails and notifications.
export const formatQuickSlot = (key: any, date?: Date | string | null): string => {
  const label = quickSlotLabel(key);
  if (!date) return label;
  const d = new Date(date);
  if (isNaN(d.getTime())) return label;
  const day = d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `${label}, ${day}`;
};
