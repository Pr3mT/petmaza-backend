import VendorDetails from '../models/VendorDetails';
import User from '../models/User';
import logger from '../config/logger';

/**
 * Petmaza Quick serviceability — the dark-store model.
 *
 * A Quick shop is a dark store at a fixed point that delivers within its own
 * radius (default 4 km), exactly like Blinkit. Pincodes are far too coarse for
 * this: 410206 alone spans New Panvel, Khanda Colony, Kalamboli and Kamothe —
 * over 10 km end to end — so a Khanda Colony shop can never promise 30-minute
 * delivery to "all of 410206".
 *
 * LEGACY FALLBACK: Quick shops that have no storeLocation yet keep their old
 * pincode behaviour, so nothing goes dark the moment this deploys. As soon as a
 * shop is given coordinates, radius becomes the ONLY rule for that shop — a
 * located shop can never be matched by pincode again, otherwise the radius
 * promise would be silently broken for anyone on an older app build.
 */

// The schema caps deliveryRadiusKm at 25, so no shop can ever serve past this.
const MAX_SEARCH_METERS = 25_000;
export const DEFAULT_RADIUS_KM = 4;

export interface ServingShop {
  vendorId: string;
  shopName: string;
  /** Straight-line distance from the customer. Undefined for legacy pincode matches. */
  distanceKm?: number;
  deliveryRadiusKm: number;
  /** How this shop was matched — 'RADIUS' is the real dark-store rule. */
  matchedBy: 'RADIUS' | 'PINCODE';
}

export interface CustomerPoint {
  lat: number;
  lng: number;
}

/**
 * Parse a customer- or admin-supplied location into {lat, lng}.
 *
 * Accepts what someone actually has on their clipboard:
 *   "19.017656, 73.119800"           (Google Maps → right-click → copy coordinates)
 *   "19.017656 73.119800"
 *   "https://maps.google.com/...@19.017656,73.119800,17z/..."   (any Maps URL)
 * Returns null when nothing usable is present, so callers can distinguish
 * "no location given" from "location given but outside every shop's radius".
 */
export function parseLatLng(raw: unknown): CustomerPoint | null {
  if (raw === undefined || raw === null) return null;
  const text = String(raw).trim();
  if (!text) return null;

  // A Google Maps URL puts the viewport centre after '@'. Prefer an explicit
  // !3dLAT!4dLNG pin (the actual place) when the URL carries one.
  const pin = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const at = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const plain = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);

  const hit = pin || at || plain;
  if (!hit) return null;

  const lat = Number(hit[1]);
  const lng = Number(hit[2]);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  // 0,0 is in the Atlantic — always an unset/failed value in this codebase.
  if (lat === 0 && lng === 0) return null;

  return { lat, lng };
}

/** Read a {lat, lng} out of a request's query or body, in any of the shapes clients send. */
export function pointFromRequest(src: any): CustomerPoint | null {
  if (!src) return null;
  if (src.lat !== undefined && src.lng !== undefined) {
    return parseLatLng(`${src.lat},${src.lng}`);
  }
  if (src.latitude !== undefined && src.longitude !== undefined) {
    return parseLatLng(`${src.latitude},${src.longitude}`);
  }
  if (src.location) return pointFromRequest(src.location);
  return null;
}

export interface StoreLocationUpdate {
  /** Human-readable validation failure; when set, the caller must reject the request. */
  error?: string;
  set?: {
    storeLocation?: { type: 'Point'; coordinates: [number, number] };
    deliveryRadiusKm?: number;
  };
  /** Admin explicitly blanked the location — the shop falls back to its pincode list. */
  clearLocation?: boolean;
}

/**
 * Validate the storeLocation / deliveryRadiusKm fields of a vendor create or
 * update payload. Shared by the admin's Shop Admin form and the shop's own
 * profile screen so both accept the same inputs and enforce the same limits.
 */
export function parseStoreLocationUpdate(body: any): StoreLocationUpdate {
  const out: StoreLocationUpdate = {};

  if (body?.storeLocation !== undefined) {
    const raw = body.storeLocation;
    const blank = raw === null || (typeof raw === 'string' && !raw.trim());
    if (blank) {
      out.clearLocation = true;
    } else {
      const point = typeof raw === 'string' ? parseLatLng(raw) : pointFromRequest(raw);
      if (!point) {
        return {
          error:
            'Store location must be "latitude, longitude" (e.g. 19.017656, 73.119800) or a Google Maps link. In Google Maps, right-click the shop and click the coordinates to copy them.',
        };
      }
      out.set = { ...out.set, storeLocation: { type: 'Point', coordinates: [point.lng, point.lat] } };
    }
  }

  if (body?.deliveryRadiusKm !== undefined && String(body.deliveryRadiusKm).trim() !== '') {
    const km = Number(body.deliveryRadiusKm);
    if (!isFinite(km) || km < 0.5 || km > 25) {
      return { error: 'Delivery radius must be a number between 0.5 and 25 km' };
    }
    out.set = { ...out.set, deliveryRadiusKm: km };
  }

  return out;
}

/** Great-circle distance in km. Used to re-check a point against a known shop. */
export function haversineKm(a: CustomerPoint, b: CustomerPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export class QuickServiceabilityService {
  /**
   * Every approved Quick shop that will deliver to this customer, nearest first.
   *
   * Pass the customer's coordinates whenever they're known. `pincode` only ever
   * reaches shops that haven't been located yet (see the LEGACY FALLBACK note
   * at the top of this file).
   */
  static async findServingShops(opts: {
    point?: CustomerPoint | null;
    pincode?: string | null;
  }): Promise<ServingShop[]> {
    const { point, pincode } = opts;
    const byVendorId = new Map<string, ServingShop>();

    if (point) {
      // $geoNear must be the first stage and only returns docs that actually
      // carry the indexed field, so unlocated shops drop out here for free.
      // Each shop has its OWN radius, so a single maxDistance can't do the
      // filtering — we cap the search at the largest allowed radius and then
      // keep only shops whose own radius reaches the customer.
      const rows = await VendorDetails.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [point.lng, point.lat] },
            distanceField: 'distanceMeters',
            maxDistance: MAX_SEARCH_METERS,
            query: { vendorType: 'QUICK_SHOP', isApproved: true },
            spherical: true,
            key: 'storeLocation',
          },
        },
        {
          $match: {
            $expr: {
              $lte: [
                '$distanceMeters',
                { $multiply: [{ $ifNull: ['$deliveryRadiusKm', DEFAULT_RADIUS_KM] }, 1000] },
              ],
            },
          },
        },
        { $project: { vendor_id: 1, shopName: 1, deliveryRadiusKm: 1, distanceMeters: 1 } },
      ]);

      rows.forEach((r: any) => {
        byVendorId.set(r.vendor_id.toString(), {
          vendorId: r.vendor_id.toString(),
          shopName: r.shopName,
          distanceKm: Math.round((r.distanceMeters / 1000) * 100) / 100,
          deliveryRadiusKm: r.deliveryRadiusKm ?? DEFAULT_RADIUS_KM,
          matchedBy: 'RADIUS',
        });
      });
    }

    const pin = String(pincode || '').trim();
    if (/^\d{6}$/.test(pin)) {
      // 'storeLocation.coordinates.0' missing covers the field being absent,
      // null, or an empty array — i.e. every shop that isn't located yet.
      const legacy = await VendorDetails.find({
        vendorType: 'QUICK_SHOP',
        isApproved: true,
        serviceablePincodes: pin,
        'storeLocation.coordinates.0': { $exists: false },
      })
        .select('vendor_id shopName deliveryRadiusKm')
        .lean();

      legacy.forEach((s: any) => {
        const id = s.vendor_id.toString();
        if (byVendorId.has(id)) return;
        byVendorId.set(id, {
          vendorId: id,
          shopName: s.shopName,
          deliveryRadiusKm: s.deliveryRadiusKm ?? DEFAULT_RADIUS_KM,
          matchedBy: 'PINCODE',
        });
      });
    }

    if (!byVendorId.size) return [];

    // VendorDetails.isApproved and the User account's approval are maintained
    // separately, so confirm the owning account is still an active Quick vendor
    // before showing its products (the pincode flow did the same).
    const activeVendors = await User.find({
      _id: { $in: Array.from(byVendorId.keys()) },
      role: 'vendor',
      vendorType: 'QUICK_SHOP',
      isApproved: true,
    })
      .select('_id')
      .lean();

    const active = new Set(activeVendors.map((v: any) => v._id.toString()));
    const shops = Array.from(byVendorId.values()).filter((s) => active.has(s.vendorId));

    // Nearest first; legacy pincode matches (no distance) sort last.
    shops.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

    logger.info(
      `[QuickServiceability] ${shops.length} shop(s) serve ` +
        `${point ? `${point.lat},${point.lng}` : `pincode ${pin || 'unknown'}`}`
    );
    return shops;
  }

  /**
   * The closest Quick shop to a point, IGNORING its radius. Only used to tell an
   * out-of-range customer how far away Quick actually reaches ("nearest store is
   * 7.2 km away, we deliver up to 4 km") instead of a flat "not available".
   */
  static async findNearestShop(
    point: CustomerPoint
  ): Promise<{ shopName: string; distanceKm: number; deliveryRadiusKm: number } | null> {
    const rows = await VendorDetails.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [point.lng, point.lat] },
          distanceField: 'distanceMeters',
          query: { vendorType: 'QUICK_SHOP', isApproved: true },
          spherical: true,
          key: 'storeLocation',
        },
      },
      { $limit: 1 },
      { $project: { shopName: 1, deliveryRadiusKm: 1, distanceMeters: 1 } },
    ]);

    if (!rows.length) return null;
    return {
      shopName: rows[0].shopName,
      distanceKm: Math.round((rows[0].distanceMeters / 1000) * 10) / 10,
      deliveryRadiusKm: rows[0].deliveryRadiusKm ?? DEFAULT_RADIUS_KM,
    };
  }
}

export default QuickServiceabilityService;
