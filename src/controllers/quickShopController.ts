import logger from '../config/logger';
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import Order from '../models/Order';
import Product from '../models/Product';
import Brand from '../models/Brand';
import VendorDetails from '../models/VendorDetails';
import QuickProductListing from '../models/QuickProductListing';
import { OrderRoutingService } from '../services/OrderRoutingService';
import QuickServiceabilityService, {
  pointFromRequest,
  ServingShop,
} from '../services/QuickServiceabilityService';
import { ShippingService } from '../services/ShippingService';
import { orderQueue } from '../services/OrderQueue';
import { sanitizeOrderForVendor } from '../utils/vendorOrderSanitizer';
import {
  sendOrderAcceptedEmail,
  sendDeliveryCompletedEmail,
  sendRefundInitiatedEmail,
  sendShippingTrackingEmail,
  sendQuickSlotBookedEmail,
} from '../services/emailer';
import ShippingDetails from '../models/ShippingDetails';
import { reconcileStuckShipping } from '../utils/shippingDetails';
import cloudinary from '../config/cloudinary';
import streamifier from 'streamifier';
import {
  isQuickSlot,
  resolveQuickSlotDate,
  formatQuickSlot,
  quickSlotStart,
  istDayStart,
  QuickSlotKey,
} from '../constants/quickSlots';

// What the customer has actually been promised: the shop admin's booked window
// once they've confirmed one, otherwise the window the customer requested.
// Orders placed before Quick moved to slots still carry the old speed picker.
const quickPromise = (order: any): string => {
  if (order.quickBookedSlot) return formatQuickSlot(order.quickBookedSlot, order.quickBookedDate);
  if (order.quickDeliverySlot) return formatQuickSlot(order.quickDeliverySlot, order.quickSlotDate);
  return order.quickDeliveryMode === 'HALF_HOUR' ? 'Within 30 minutes' : 'Within 1 day';
};

// ==================== CUSTOMER-FACING ====================

// Petmaza Quick is a dark-store network: each shop delivers within its own
// radius of its own location (default 4 km), not across a whole pincode. The
// customer's COORDINATES are therefore what decides serviceability — a pincode
// like 410206 spans New Panvel to Kalamboli and can never be served in 30
// minutes from one shop. See QuickServiceabilityService for the matching rules
// (including the pincode fallback for shops that aren't located yet).

// Resolve the shops that serve this request from its lat/lng (falling back to
// pincode for unlocated shops), shared by every customer-facing endpoint.
async function resolveShops(src: any) {
  const point = pointFromRequest(src);
  const pincode = String(src?.pincode || '').trim();
  const shops = await QuickServiceabilityService.findServingShops({ point, pincode });
  return { point, pincode, shops };
}

// Shape a serving-shops list into the response envelope every Quick screen reads.
function shopsPayload(shops: ServingShop[]) {
  return {
    available: shops.length > 0,
    shopName: shops[0]?.shopName || '',
    vendorId: shops[0]?.vendorId,
    shopCount: shops.length,
    // Nearest first, so the app can show "Delivering from <nearest>, 1.2 km away".
    shops: shops.map((s) => ({
      vendorId: s.vendorId,
      shopName: s.shopName,
      distanceKm: s.distanceKm,
      deliveryRadiusKm: s.deliveryRadiusKm,
    })),
  };
}

// Whether Petmaza Quick reaches a given point, and which dark stores cover it.
// Several shops can overlap one address; the customer sees all of them.
export const getAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { point, pincode, shops } = await resolveShops(req.query);
    if (!point && !pincode) {
      return next(new AppError('Your location is required to check Petmaza Quick availability', 400));
    }

    if (!shops.length) {
      // Out of range is far more useful than a bare "no": tell them how close
      // Quick actually gets, so they know it's distance and not a dead area.
      const nearest = point ? await QuickServiceabilityService.findNearestShop(point) : null;
      return res.status(200).json({
        success: true,
        data: { available: false, shops: [], shopCount: 0, nearest },
      });
    }

    res.status(200).json({ success: true, data: shopsPayload(shops) });
  } catch (error: any) {
    next(error);
  }
};

// Catalog products deliverable to the customer's point, with each serving shop's
// own price/stock. When several dark stores cover the point, the customer sees
// every shop's listings — each product carries the shop it comes from
// (shopId/shopName/shopDistanceKm), so one catalog product may appear per shop.
export const getQuickProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { point, pincode, shops } = await resolveShops(req.query);
    if (!point && !pincode) {
      return next(new AppError('Your location is required to browse Petmaza Quick', 400));
    }

    if (!shops.length) {
      const nearest = point ? await QuickServiceabilityService.findNearestShop(point) : null;
      return res
        .status(200)
        .json({ success: true, data: { available: false, shops: [], shopCount: 0, nearest, products: [] } });
    }

    const shopNameById = new Map(shops.map((s) => [s.vendorId, s.shopName]));
    const shopDistanceById = new Map(shops.map((s) => [s.vendorId, s.distanceKm]));

    const listings = await QuickProductListing.find({
      vendor_id: { $in: shops.map((s) => s.vendorId) },
      isActive: true,
      stock: { $gt: 0 },
    })
      .populate({
        path: 'product_id',
        match: { isActive: true },
        populate: [{ path: 'brand_id', select: 'name' }, { path: 'category_id', select: 'name' }],
      })
      .lean();

    const products = listings
      .filter((l: any) => l.product_id)
      .map((l: any) => ({
        ...l.product_id,
        // Petmaza sets the Quick price; the shop's listing only supplies stock.
        // Products not yet priced for Quick fall back to the shop's legacy
        // listing price so the storefront never shows a blank or ₹0 price
        // mid-migration. Must match the resolution in
        // OrderRoutingService.routeQuickOrder, or the cart would quote one
        // price and the order would be placed at another.
        sellingPrice: Number(l.product_id.quickSellingPrice) || l.sellingPrice,
        mrp: l.product_id.mrp ?? (Number(l.product_id.quickSellingPrice) || l.sellingPrice),
        stock: l.stock,
        inStock: l.stock > 0,
        quickListingId: l._id,
        shopId: l.vendor_id.toString(),
        shopName: shopNameById.get(l.vendor_id.toString()) || '',
        shopDistanceKm: shopDistanceById.get(l.vendor_id.toString()),
      }));

    res.status(200).json({
      success: true,
      data: { ...shopsPayload(shops), products },
    });
  } catch (error: any) {
    next(error);
  }
};

// ==================== CUSTOMER-FACING — ADDRESS SEARCH ====================
// Desktop browsers have no GPS chip: navigator.geolocation falls back to WiFi
// lookup and then to plain IP geolocation, which resolves to the ISP's regional
// node and routinely lands 25 km+ from the real address. Against a 4 km delivery
// radius that produces confidently wrong answers in both directions, so a
// customer needs a way to say where they actually are.
//
// Backed by OpenStreetMap's Nominatim — free, no API key, no billing. We proxy
// it instead of calling from the app so the User-Agent their usage policy
// requires is actually sent, and so caching and the 1-request/second limit live
// in one place rather than once per client.

const geocodeCache = new Map<string, { at: number; results: any[] }>();
const GEOCODE_TTL_MS = 24 * 60 * 60 * 1000; // Places don't move; a day is conservative.
const GEOCODE_MAX_ENTRIES = 500;
const NOMINATIM_MIN_GAP_MS = 1100; // Their policy allows at most 1 req/sec.

let geocodeChain: Promise<any> = Promise.resolve();
let lastGeocodeAt = 0;

// Serialize outbound calls and space them out, so bursts of typing from several
// customers can never exceed Nominatim's rate limit. Forward ("search") and
// reverse lookups share one queue because the limit is per-client, not per-endpoint.
async function nominatimGet(endpoint: 'search' | 'reverse', params: Record<string, string>): Promise<any> {
  const run = geocodeChain.then(async () => {
    const wait = Math.max(0, lastGeocodeAt + NOMINATIM_MIN_GAP_MS - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastGeocodeAt = Date.now();

    const url = new URL(`https://nominatim.openstreetmap.org/${endpoint}`);
    url.searchParams.set('format', 'jsonv2');
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const response = await fetch(url, {
      headers: {
        'User-Agent': `Petmaza/1.0 (${process.env.GEOCODE_CONTACT_EMAIL || 'support@petmaza.com'})`,
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      throw new AppError('Address lookup is temporarily unavailable. Please try again.', 503);
    }
    return response.json();
  });
  // Keep the chain alive after a failure, or one error would wedge every
  // subsequent lookup behind a rejected promise.
  geocodeChain = run.catch(() => undefined);
  return run;
}

// Nominatim labels are long and administrative ("Khanda Colony, Panvel, Raigad,
// Maharashtra, 410206, India"). Customers want to recognise their area at a
// glance, so keep the specific parts and drop the state/pincode/country tail.
function shortAreaLabel(place: any): string {
  const a = place?.address || {};
  const area =
    a.neighbourhood || a.suburb || a.village || a.town || a.hamlet || a.residential || a.quarter;
  const city = a.city || a.town || a.municipality || a.county;
  const parts = [area, city].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);
  if (parts.length) return parts.join(', ');
  return String(place?.display_name || '').split(',').slice(0, 2).join(',').trim();
}

export const searchAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Cap the length before anything else: a real locality name is short, and
    // an unbounded string would be forwarded straight to a third-party service
    // and cached under its own key, letting one client poison the cache.
    const q = String(req.query.q || '').trim().slice(0, 120);
    if (q.length < 3) {
      return res.status(200).json({ success: true, data: { results: [] } });
    }

    const key = q.toLowerCase();
    const cached = geocodeCache.get(key);
    if (cached && Date.now() - cached.at < GEOCODE_TTL_MS) {
      return res.status(200).json({ success: true, data: { results: cached.results } });
    }

    const raw = await nominatimGet('search', {
      q,
      countrycodes: 'in',
      limit: '6',
      addressdetails: '1',
    });
    const results = ((raw || []) as any[])
      .map((r: any) => ({
        label: r.display_name,
        // What the app shows once this result is picked.
        area: shortAreaLabel(r),
        lat: Number(r.lat),
        lng: Number(r.lon),
      }))
      .filter((r: any) => isFinite(r.lat) && isFinite(r.lng));

    // Cheap FIFO bound — this cache exists to spare Nominatim, not to be clever.
    if (geocodeCache.size >= GEOCODE_MAX_ENTRIES) {
      geocodeCache.delete(geocodeCache.keys().next().value as string);
    }
    geocodeCache.set(key, { at: Date.now(), results });

    res.status(200).json({ success: true, data: { results } });
  } catch (error: any) {
    next(error);
  }
};

// Coordinates → area name. A GPS fix is just numbers, and "Your current
// location" tells the customer nothing about whether we understood where they
// are — showing "Khanda Colony, Panvel" lets them catch a wrong pin themselves.
export const reverseGeocode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const point = pointFromRequest(req.query);
    if (!point) {
      return next(new AppError('A valid lat and lng are required', 400));
    }

    // Round to ~100 m for the cache key: finer precision would make every fix a
    // unique miss, and an area name doesn't change within a block anyway.
    const key = `r:${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;
    const cached = geocodeCache.get(key);
    if (cached && Date.now() - cached.at < GEOCODE_TTL_MS) {
      return res.status(200).json({ success: true, data: { area: cached.results[0] || '' } });
    }

    const place = await nominatimGet('reverse', {
      lat: String(point.lat),
      lon: String(point.lng),
      zoom: '16', // Neighbourhood level — the granularity customers recognise.
      addressdetails: '1',
    });
    const area = shortAreaLabel(place);

    if (geocodeCache.size >= GEOCODE_MAX_ENTRIES) {
      geocodeCache.delete(geocodeCache.keys().next().value as string);
    }
    geocodeCache.set(key, { at: Date.now(), results: [area] });

    res.status(200).json({ success: true, data: { area } });
  } catch (error: any) {
    next(error);
  }
};

// Place a Petmaza Quick order — routed by the delivery point. The cart may hold
// products from different dark stores whose radii both cover that point; routing
// creates one order per shop.
export const createQuickOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { items, customerPincode, customerAddress, deliverySlot } = req.body;

    if (!items || items.length === 0) {
      return next(new AppError('Order must have at least one item', 400));
    }
    if (!customerPincode || !customerAddress) {
      return next(new AppError('Pincode and address are required', 400));
    }
    if (!isQuickSlot(deliverySlot)) {
      return next(new AppError('Please choose a delivery slot', 400));
    }
    // Which day the booked window falls on is decided here, not by the client —
    // a phone with a wrong clock must not be able to book a window that has
    // already passed.
    const slotDate = resolveQuickSlotDate(deliverySlot);

    // The delivery point is what serviceability is judged on. It may ride on the
    // address (the saved-address coords) or be sent alongside it (a fresh GPS fix).
    const deliveryPoint = pointFromRequest(customerAddress) || pointFromRequest(req.body);
    const servingShops = await QuickServiceabilityService.findServingShops({
      point: deliveryPoint,
      pincode: String(customerPincode).trim(),
    });

    if (!servingShops.length) {
      // Say WHY it failed — "we don't reach you" and "we don't know where you
      // are" need completely different fixes from the customer.
      if (!deliveryPoint) {
        return next(
          new AppError(
            'We need your delivery location to place a Petmaza Quick order. Tap "Use my current location" on the address, then try again.',
            400
          )
        );
      }
      const nearest = await QuickServiceabilityService.findNearestShop(deliveryPoint);
      return next(
        new AppError(
          nearest
            ? `Petmaza Quick doesn't reach this address yet. The nearest store (${nearest.shopName}) is ${nearest.distanceKm} km away and delivers up to ${nearest.deliveryRadiusKm} km.`
            : "Petmaza Quick isn't available at this address yet.",
          400
        )
      );
    }

    let contactPhone = String(customerAddress.phone || req.user.phone || '').replace(/\D/g, '');
    if (contactPhone.length > 10) contactPhone = contactPhone.slice(-10);
    if (contactPhone.length !== 10) {
      return next(new AppError('A valid 10-digit contact number is required to place an order', 400));
    }
    customerAddress.phone = contactPhone;
    // Snapshot the delivery point on the order so the rider, and any later
    // dispute about "was this actually in range", reads the exact coordinates
    // the order was accepted against — not whatever the address resolves to later.
    if (deliveryPoint) {
      customerAddress.location = { lat: deliveryPoint.lat, lng: deliveryPoint.lng };
    }

    const { orders } = await OrderRoutingService.routeQuickOrder({
      customer_id: req.user._id.toString(),
      items,
      customerPincode,
      customerAddress,
      deliverySlot,
      slotDate,
      servingShops,
    });

    // ── Petmaza Quick delivery & platform fee (admin-controlled) ──────────────
    // Charges are computed once on the combined Quick cart subtotal, then split
    // evenly across the per-shop orders (mirrors the normal checkout flow).
    const combinedSubtotal = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const charges = await ShippingService.calculateQuickCharges(combinedSubtotal);

    await Promise.all(
      orders.map((order) => {
        order.subtotalBeforeCharges = order.total;
        order.shippingCharges = Math.round(charges.shippingCharges / orders.length);
        order.platformFee = Math.round(charges.platformFee / orders.length);
        order.total = order.subtotalBeforeCharges + order.shippingCharges + order.platformFee;
        order.grandTotal = order.total;
        return order.save();
      })
    );

    const totalAmount = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const isSplitShipment = orders.length > 1;

    logger.info(
      `[createQuickOrder] ${orders.length} Quick order(s) created (${formatQuickSlot(deliverySlot, slotDate)})`
    );

    res.status(201).json({
      success: true,
      message: 'Quick order created successfully',
      data: { orders, isSplitShipment, totalAmount, deliverySlot, slotDate },
    });

    orderQueue.emit('order:created', {
      userEmail: req.user.email,
      userName: req.user.name,
      userId: req.user._id.toString(),
      orderIds: orders.map((o) => o._id.toString()),
      isSplitShipment,
      combinedSubtotal,
      shippingCharges: charges.shippingCharges,
      platformFee: charges.platformFee,
      discountAmount: 0,
      customerAddress: orders[0].customerAddress,
      adminEmails: process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim()).filter(Boolean) : [],
      totalAmount,
    });
  } catch (error: any) {
    next(error);
  }
};

// ==================== SHOP ADMIN — CATALOG & LISTINGS ====================

// Browse the full existing product catalog to pick products from for Quick.
export const getCatalog = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search = '', page = 1, limit = 30 } = req.query as any;
    // Exclude other shops' own (private) Quick products from the shared catalog.
    const query: any = { isActive: true, quickOwnerVendorId: { $exists: false } };
    if (search) query.name = { $regex: String(search), $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      Product.find(query).select('name images mrp sellingPrice brand_id mainCategory subCategory').populate('brand_id', 'name').sort({ name: 1 }).skip(skip).limit(Number(limit)),
      Product.countDocuments(query),
    ]);

    res.status(200).json({ success: true, data: { products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (error: any) {
    next(error);
  }
};

export const getMyListings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const listings = await QuickProductListing.find({ vendor_id: req.user._id })
      .populate({
        path: 'product_id',
        // quickSellingPrice/quickPurchasePrice so the shop sees the price
        // Petmaza actually sells at and the rate they are billed at, rather
        // than the legacy price they used to set themselves.
        select:
          'name images mrp brand_id description mainCategory subCategory quickOwnerVendorId quickSellingPrice quickPurchasePrice',
        populate: { path: 'brand_id', select: 'name' },
      })
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { listings } });
  } catch (error: any) {
    next(error);
  }
};

export const upsertListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Petmaza prices Quick, so a shop declares availability only. Any
    // sellingPrice in the body is ignored rather than rejected — an older app
    // build still sends one, and failing those requests would take every
    // un-updated shop's stock control offline.
    const { product_id, stock, isActive } = req.body;
    if (!product_id) {
      return next(new AppError('product_id is required', 400));
    }
    if (stock !== undefined && (isNaN(Number(stock)) || Number(stock) < 0)) {
      return next(new AppError('stock must be a non-negative number', 400));
    }

    const product = await Product.findById(product_id).select(
      '_id quickOwnerVendorId sellingPrice quickSellingPrice'
    );
    if (!product) {
      return next(new AppError('Product not found', 404));
    }
    // Another shop's private product can't be listed by this vendor.
    if (product.quickOwnerVendorId && product.quickOwnerVendorId.toString() !== req.user._id.toString()) {
      return next(new AppError('This product belongs to another shop', 403));
    }

    const listing = await QuickProductListing.findOneAndUpdate(
      { vendor_id: req.user._id, product_id },
      {
        $set: {
          ...(stock !== undefined ? { stock: Number(stock) } : {}),
          ...(isActive !== undefined ? { isActive: !!isActive } : {}),
        },
        // sellingPrice is required by the schema and survives as the pre-Quick
        // -pricing fallback, so a NEW listing is seeded from the catalogue
        // rather than left at 0. $setOnInsert, not $set: an existing listing
        // keeps the historical price it was created with.
        $setOnInsert: {
          sellingPrice:
            Number(product.quickSellingPrice) || Number(product.sellingPrice) || 0,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).populate('product_id', 'name images mrp brand_id');

    res.status(200).json({ success: true, data: { listing } });
  } catch (error: any) {
    next(error);
  }
};

export const deleteListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { product_id } = req.params;
    await QuickProductListing.findOneAndDelete({ vendor_id: req.user._id, product_id });
    res.status(200).json({ success: true, message: 'Removed from Petmaza Quick' });
  } catch (error: any) {
    next(error);
  }
};

// ==================== SHOP ADMIN — OWN PRODUCTS ====================
// A shop can also sell products that aren't in the Petmaza catalog. These are
// stored as regular Product docs tagged with quickOwnerVendorId so the whole
// order/stock pipeline works unchanged, but they stay private to this shop —
// hidden from the main website catalog and other shops' Quick catalogs.

const QUICK_PET_TYPES = ['Dog', 'Cat', 'Fish', 'Bird', 'Small Animals'];

// The vendor's own products carry the brand they typed, falling back to their
// shop name (find-or-create either way).
async function getOwnBrand(vendorId: string, brandName?: string) {
  let name = String(brandName || '').trim();
  if (!name) {
    const details = await VendorDetails.findOne({ vendor_id: vendorId }).select('shopName').lean();
    name = String((details as any)?.shopName || 'My Shop').trim() || 'My Shop';
  }
  const existing = await Brand.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
  if (existing) return existing;
  return Brand.create({ name, description: `Products by ${name}` });
}

export const createOwnProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, description, image, mainCategory, subCategory, brand, mrp, sellingPrice, stock } = req.body;

    if (!name || !String(name).trim()) {
      return next(new AppError('Product name is required', 400));
    }
    if (!QUICK_PET_TYPES.includes(mainCategory)) {
      return next(new AppError(`Pet type must be one of: ${QUICK_PET_TYPES.join(', ')}`, 400));
    }
    const price = Number(sellingPrice);
    if (!sellingPrice || isNaN(price) || price <= 0) {
      return next(new AppError('A valid selling price is required', 400));
    }
    const qty = Number(stock);
    if (stock === undefined || stock === null || stock === '' || isNaN(qty) || qty < 0) {
      return next(new AppError('A valid stock quantity is required', 400));
    }
    // MRP defaults to the selling price and can never sit below it.
    const productMrp = mrp !== undefined && mrp !== null && String(mrp) !== '' ? Math.max(Number(mrp) || 0, price) : price;

    const brandDoc = await getOwnBrand(req.user._id.toString(), brand);
    const product = await Product.create({
      name: String(name).trim(),
      description: description ? String(description).trim() : undefined,
      brand_id: brandDoc._id,
      mainCategory: [mainCategory],
      subCategory: [String(subCategory || '').trim() || 'Shop Special'],
      mrp: productMrp,
      sellingPrice: price,
      // Set explicitly — schema validation runs before the pre-save hook computes it.
      sellingPercentage: productMrp > 0 ? Math.round((price / productMrp) * 100 * 100) / 100 : 100,
      images: image ? [image] : [],
      isActive: true,
      inStock: qty > 0,
      addedBy: req.user._id,
      quickOwnerVendorId: req.user._id,
    });

    const listing = await QuickProductListing.create({
      vendor_id: req.user._id,
      product_id: product._id,
      sellingPrice: price,
      stock: qty,
      isActive: true,
    });

    res.status(201).json({ success: true, message: 'Product created', data: { product, listing } });
  } catch (error: any) {
    next(error);
  }
};

export const updateOwnProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const product = await Product.findOne({ _id: productId, quickOwnerVendorId: req.user._id });
    if (!product) {
      return next(new AppError('Product not found or not owned by you', 404));
    }

    const { name, description, image, mainCategory, subCategory, brand, mrp, sellingPrice, stock } = req.body;

    if (name !== undefined) {
      if (!String(name).trim()) return next(new AppError('Product name cannot be empty', 400));
      product.name = String(name).trim();
    }
    if (description !== undefined) product.description = String(description).trim();
    if (image !== undefined) product.images = image ? [image] : [];
    if (mainCategory !== undefined) {
      if (!QUICK_PET_TYPES.includes(mainCategory)) {
        return next(new AppError(`Pet type must be one of: ${QUICK_PET_TYPES.join(', ')}`, 400));
      }
      product.mainCategory = [mainCategory];
    }
    if (subCategory !== undefined) {
      product.subCategory = [String(subCategory || '').trim() || 'Shop Special'];
    }
    if (brand !== undefined && String(brand).trim()) {
      const brandDoc = await getOwnBrand(req.user._id.toString(), brand);
      product.brand_id = brandDoc._id as any;
    }

    let price = product.sellingPrice || 0;
    if (sellingPrice !== undefined) {
      price = Number(sellingPrice);
      if (isNaN(price) || price <= 0) return next(new AppError('A valid selling price is required', 400));
      product.sellingPrice = price;
    }
    if (mrp !== undefined && mrp !== null && String(mrp) !== '') {
      product.mrp = Math.max(Number(mrp) || 0, price);
    } else if ((product.mrp || 0) < price) {
      product.mrp = price;
    }

    let qty: number | undefined;
    if (stock !== undefined) {
      qty = Number(stock);
      if (isNaN(qty) || qty < 0) return next(new AppError('A valid stock quantity is required', 400));
      product.inStock = qty > 0;
    }

    await product.save();

    const listing = await QuickProductListing.findOneAndUpdate(
      { vendor_id: req.user._id, product_id: product._id },
      {
        $set: {
          sellingPrice: price,
          ...(qty !== undefined ? { stock: qty } : {}),
          isActive: true,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true, message: 'Product updated', data: { product, listing } });
  } catch (error: any) {
    next(error);
  }
};

export const deleteOwnProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const product = await Product.findOne({ _id: productId, quickOwnerVendorId: req.user._id });
    if (!product) {
      return next(new AppError('Product not found or not owned by you', 404));
    }

    await QuickProductListing.findOneAndDelete({ vendor_id: req.user._id, product_id: product._id });
    // Soft-delete so past orders keep a valid product reference.
    product.isActive = false;
    await product.save();

    res.status(200).json({ success: true, message: 'Product deleted' });
  } catch (error: any) {
    next(error);
  }
};

// ==================== SHOP ADMIN — ORDERS ====================
// Mirrors myShopVendorController's accept/reject/pack/pickup/deliver flow,
// scoped to this vendor's QUICK-channel orders.

export const getQuickShopOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vendor = req.user;
    // Quick is a same-day channel, so the shop admin only works today's and
    // yesterday's orders — anything older is history and stays in the admin
    // panel, which is unfiltered. The window is IST wall-clock midnight so it
    // flips over at the shop's day, not the server's UTC day.
    const since = istDayStart(new Date(), -1);
    const orders = await Order.find({
      payment_status: 'Paid',
      assignedVendorId: vendor._id,
      orderChannel: 'QUICK',
      createdAt: { $gte: since },
    })
      .populate('customer_id', 'name email phone')
      .populate('items.product_id', 'name images')
      .sort({ createdAt: -1 });

    const sanitized = orders.map((o) => {
      const plain = o.toObject();
      const sanitizedOrder = sanitizeOrderForVendor(plain);
      sanitizedOrder.customerPaidTotal = plain.grandTotal || plain.total || 0;
      // Quick shop admins hand the order to the customer themselves, so they see
      // the customer's delivery charge and platform fee (the generic vendor
      // sanitizer strips both). These are platform revenue, not shop earnings —
      // the app shows them under "what the customer paid", never in the payout.
      sanitizedOrder.quickShippingCharges = plain.shippingCharges || 0;
      sanitizedOrder.quickPlatformFee = plain.platformFee || 0;
      return sanitizedOrder;
    });

    res.status(200).json({ success: true, data: { orders: sanitized } });
  } catch (error: any) {
    next(error);
  }
};

// Shop admin wallet — same response shape as getPrimeWalletStats so the app can
// reuse the Wallet screen. The shop earns the item subtotal only: the delivery
// charge and platform fee the customer paid are platform revenue (same rule the
// orders list follows when it exposes them separately).
const quickShopShare = (order: any) => {
  if (typeof order.subtotalBeforeCharges === 'number') return order.subtotalBeforeCharges;
  return Math.max(
    (order.total || 0) - (order.shippingCharges || 0) - (order.platformFee || 0),
    0
  );
};

export const getQuickWalletStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vendor_id = req.user._id;
    const { startDate, endDate } = req.query;

    const query: any = {
      assignedVendorId: vendor_id,
      orderChannel: 'QUICK',
      payment_status: 'Paid',
      status: { $nin: ['CANCELLED', 'REJECTED'] },
    };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const allOrders = await Order.find(query)
      .populate('customer_id', 'name email phone')
      .populate('items.product_id', 'name images')
      .sort({ createdAt: -1 })
      .lean();

    let totalEarnings = 0;
    let pendingSettlement = 0;
    let completedOrders = 0;

    const orders = allOrders.map((order: any) => {
      const share = quickShopShare(order);
      const isDelivered = order.status === 'DELIVERED';
      if (isDelivered) {
        totalEarnings += share;
        completedOrders += 1;
      } else {
        pendingSettlement += share;
      }

      return {
        orderId: order.order_id || order._id,
        orderDate: order.createdAt,
        customerName: (order.customer_id as any)?.name || 'N/A',
        products: (order.items || []).map((i: any) => i.product_id?.name || 'Product').join(', '),
        status: order.status,
        vendorEarning: isDelivered ? share : 0,
        pendingAmount: isDelivered ? 0 : share,
        paymentStatus: order.payment_status || 'N/A',
      };
    });

    const monthlyMap: Record<string, { month: string; orders: number; earnings: number }> = {};
    const statusBreakdown: Record<string, number> = {};
    allOrders.forEach((order: any) => {
      statusBreakdown[order.status] = (statusBreakdown[order.status] || 0) + 1;
      if (order.status !== 'DELIVERED') return;
      const d = new Date(order.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      if (!monthlyMap[key]) monthlyMap[key] = { month: label, orders: 0, earnings: 0 };
      monthlyMap[key].orders += 1;
      monthlyMap[key].earnings += quickShopShare(order);
    });
    const monthlyBreakdown = Object.values(monthlyMap).sort((a, b) => (a.month > b.month ? 1 : -1));

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalOrders: allOrders.length,
          completedOrders,
          totalEarnings,
          pendingSettlement,
          platformFee: '0%',
        },
        statusBreakdown,
        monthlyBreakdown,
        orders,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

async function findOwnQuickOrder(vendor: any, orderId: string) {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', 404);
  if (order.orderChannel !== 'QUICK') throw new AppError('Not a Petmaza Quick order', 400);
  if (order.assignedVendorId?.toString() !== vendor._id.toString()) {
    throw new AppError('This order is not assigned to you', 403);
  }
  return order;
}

// The shop admin books the delivery window for an incoming Quick order. They
// normally confirm the window the customer asked for, but can move it to one
// they can actually hit — moving it emails the customer, because a silently
// changed window is a missed delivery.
//
// `forTomorrow` exists because a shop taking a late order may only be able to
// serve the requested window the next day.
export const bookDeliverySlot = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const { slot, forTomorrow, note } = req.body || {};
    const order = await findOwnQuickOrder(req.user, orderId);

    // Once it's left the shop the window is a promise already in flight — the
    // shop should be updating the courier, not re-booking the slot.
    if (['REJECTED', 'CANCELLED', 'REFUND_INITIATED', 'REFUNDED', 'DELIVERED'].includes(order.status)) {
      return next(new AppError(`Cannot book a delivery slot for an order that is ${order.status}`, 400));
    }
    if (['PICKED_UP', 'IN_TRANSIT'].includes(order.status)) {
      return next(new AppError('This order is already out for delivery — its slot can no longer be changed', 400));
    }

    // No slot sent means "confirm what the customer picked".
    const chosen: QuickSlotKey = isQuickSlot(slot)
      ? slot
      : (order.quickDeliverySlot as QuickSlotKey) || (null as any);
    if (!isQuickSlot(chosen)) {
      return next(new AppError('Please choose a delivery slot to book', 400));
    }

    const previous = order.quickBookedSlot
      ? formatQuickSlot(order.quickBookedSlot, order.quickBookedDate)
      : formatQuickSlot(order.quickDeliverySlot, order.quickSlotDate);

    const bookedDate = forTomorrow ? quickSlotStart(chosen, new Date(), 1) : resolveQuickSlotDate(chosen);

    order.quickBookedSlot = chosen;
    order.quickBookedDate = bookedDate;
    order.quickSlotBookedAt = new Date();
    order.quickSlotBookedBy = req.user._id;
    if (note !== undefined) order.quickSlotNote = String(note).trim().slice(0, 300);
    await order.save();

    const booked = formatQuickSlot(chosen, bookedDate);
    logger.info(`[quickShop:bookDeliverySlot] Order ${orderId} booked for ${booked} by shop ${req.user._id}`);

    try {
      const populated = await order.populate('customer_id', 'name email');
      const customer = populated.customer_id as any;
      if (customer?.email) {
        await sendQuickSlotBookedEmail(
          customer.email,
          customer.name || 'Customer',
          `#${order._id.toString().slice(-8)}`,
          booked,
          { shopName: req.user.name, movedFrom: previous, note: order.quickSlotNote }
        );
      }
    } catch (emailError: any) {
      logger.error('[quickShop:bookDeliverySlot] Failed to send email:', emailError.message);
    }

    res.status(200).json({
      success: true,
      message: `Delivery slot booked for ${booked}`,
      data: { order, bookedSlot: booked },
    });
  } catch (error: any) {
    next(error);
  }
};

export const acceptOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const order = await findOwnQuickOrder(req.user, orderId);

    if (order.status !== 'PENDING') {
      return next(new AppError(`Order is already ${order.status}`, 400));
    }
    if (order.payment_status !== 'Paid') {
      return next(new AppError('Order cannot be accepted before successful payment', 400));
    }

    // Deduct stock from the shop's own Quick listings now that they've committed to fulfil it.
    for (const item of order.items) {
      await QuickProductListing.updateOne(
        { vendor_id: req.user._id, product_id: item.product_id },
        { $inc: { stock: -item.quantity } }
      );
    }

    order.status = 'ACCEPTED';
    await order.save();

    try {
      const populatedOrder = await order.populate('customer_id');
      const customer = populatedOrder.customer_id as any;
      if (customer?.email) {
        await sendOrderAcceptedEmail(
          customer.email,
          customer.name || 'Customer',
          `#${order._id.toString().slice(-8)}`,
          req.user.name || 'Shop Admin',
          quickPromise(order)
        );
      }
    } catch (emailError: any) {
      logger.error('[quickShop:acceptOrder] Failed to send email:', emailError.message);
    }

    res.status(200).json({ success: true, message: 'Order accepted successfully', data: { order } });
  } catch (error: any) {
    next(error);
  }
};

// Shop admin can't fulfil this order — refund it (same as MY_SHOP's flow for prepaid orders).
export const rejectOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const order = await findOwnQuickOrder(req.user, orderId).then((o) => o.populate('customer_id', 'name email phone'));

    if (!['PENDING', 'ACCEPTED'].includes(order.status)) {
      return next(new AppError(`Cannot reject order that is already ${order.status}`, 400));
    }

    if (order.status === 'ACCEPTED') {
      for (const item of order.items) {
        await QuickProductListing.updateOne(
          { vendor_id: req.user._id, product_id: item.product_id },
          { $inc: { stock: item.quantity } }
        );
      }
    }

    order.status = 'REFUND_INITIATED';
    order.refundReason = reason || 'Unable to fulfil order';
    order.refundedAt = new Date();
    if (order.payment_status === 'Paid') {
      order.refundStatus = 'PENDING';
      order.refundAmount = order.grandTotal || order.total || 0;
    }
    await order.save();

    try {
      const customer = order.customer_id as any;
      if (customer?.email) {
        await sendRefundInitiatedEmail(
          customer.email,
          customer.name || 'Customer',
          `#${order._id.toString().slice(-8)}`,
          order.refundAmount || order.total || 0,
          order.refundReason || 'Product not available'
        );
      }
    } catch (emailError: any) {
      logger.error('[quickShop:rejectOrder] Failed to send email:', emailError.message);
    }

    res.status(200).json({ success: true, message: 'Order rejected and refund initiated', data: { order } });
  } catch (error: any) {
    next(error);
  }
};

// ─── Delivery partner details (ACCEPTED → IN_TRANSIT, Quick Shop Admin) ──────
// Petmaza Quick is a local same-day hand-off, not a courier shipment: the shop
// gives the order to a delivery partner and it is on its way. There is no Packed
// or Picked Up stage to sit in — naming the partner and what the drop costs is
// what puts the order out for delivery, so this one form does that transition.
//
// PACKED is still accepted as a starting point so the handful of orders placed
// under the older Packed → Picked Up flow can finish through the same form.
const PARTNER_FORM_STATUSES = ['ACCEPTED', 'PACKED'];

export const addShippingDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vendor_id = req.user._id;
    const { orderId } = req.params;
    const {
      shipping_company,
      tracking_id,
      tracking_link,
      shipping_cost,
      total_weight,
      weight_unit,
      delivery_type,
    } = req.body;

    // ── The two fields a Quick hand-off actually needs ────────────────────────
    if (!shipping_company || !String(shipping_company).trim()) {
      return next(new AppError('Delivery partner name is required', 400));
    }
    if (shipping_cost === undefined || String(shipping_cost).trim() === '') {
      return next(new AppError('Delivery cost is required', 400));
    }
    if (isNaN(Number(shipping_cost)) || Number(shipping_cost) < 0) {
      return next(new AppError('Delivery cost must be a non-negative number', 400));
    }
    // ── Everything else is optional — a local rider has no tracking number ────
    const trackingId = tracking_id ? String(tracking_id).trim() : '';
    const trackingLink = tracking_link ? String(tracking_link).trim() : '';
    if (trackingLink && !/^https?:\/\/\S+$/i.test(trackingLink)) {
      return next(new AppError('Tracking link must be a valid URL starting with http:// or https://', 400));
    }
    const hasWeight = total_weight !== undefined && String(total_weight).trim() !== '';
    if (hasWeight && (isNaN(Number(total_weight)) || Number(total_weight) <= 0)) {
      return next(new AppError('Total weight must be a positive number', 400));
    }
    if (hasWeight && !['kg', 'g'].includes(weight_unit)) {
      return next(new AppError('Weight unit must be kg or g', 400));
    }
    if (delivery_type && !['inter_state', 'out_of_state'].includes(delivery_type)) {
      return next(new AppError('Delivery type must be inter_state or out_of_state', 400));
    }

    const order = await findOwnQuickOrder(req.user, orderId);
    if (!PARTNER_FORM_STATUSES.includes(order.status)) {
      return next(new AppError(`Cannot add delivery partner details for an order that is ${order.status}`, 400));
    }

    const existing = await ShippingDetails.findOne({ order_id: orderId });
    if (existing) {
      // Already on file but the order never moved — finish that transition
      // rather than leaving the shop stuck on a button that can only 409.
      if (await reconcileStuckShipping(order, existing, { from: order.status, to: 'IN_TRANSIT' })) {
        logger.info(`[QuickShop] Order ${orderId} already had delivery partner details — advanced to IN_TRANSIT`);
        return res.status(200).json({
          success: true,
          message: 'Delivery partner details were already on file. Order marked as out for delivery.',
          data: { order },
        });
      }
      return next(new AppError('Delivery partner details already submitted for this order', 409));
    }

    // ── Upload receipt to Cloudinary (optional) ──────────────────────────────
    let uploadResult: any = null;
    if (req.file) {
      const isPdf = req.file.mimetype === 'application/pdf';
      uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'petmaza/shipping-receipts',
            resource_type: isPdf ? 'raw' : 'image',
            ...(isPdf ? { format: 'pdf' } : {}),
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        streamifier.createReadStream(req.file!.buffer).pipe(stream);
      });
    }

    const shippingDetails = await ShippingDetails.create({
      order_id: orderId,
      vendor_id,
      // Quick shop booked the courier themselves — reimbursable on payout.
      shipping_arranged_by: 'VENDOR',
      arranged_by_user_id: vendor_id,
      shipping_company: String(shipping_company).trim(),
      ...(uploadResult
        ? { receipt_file_url: uploadResult.secure_url, receipt_file_public_id: uploadResult.public_id }
        : {}),
      ...(trackingId ? { tracking_id: trackingId } : {}),
      ...(trackingLink ? { tracking_link: trackingLink } : {}),
      shipping_cost: Number(shipping_cost),
      ...(hasWeight ? { total_weight: Number(total_weight), weight_unit } : {}),
      ...(delivery_type ? { delivery_type } : {}),
    });

    order.status = 'IN_TRANSIT';
    if (!order.courier) order.courier = {};
    order.courier.name = String(shipping_company).trim();
    if (trackingId) order.courier.tracking_id = trackingId;
    if (trackingLink) order.courier.tracking_link = trackingLink;
    await order.save();

    logger.info(`[quickShop] Delivery partner details added for order ${orderId} by shop ${vendor_id}`);

    try {
      const populatedOrder = await order.populate('customer_id');
      const customer = populatedOrder.customer_id as any;
      if (customer?.email) {
        await sendShippingTrackingEmail(
          customer.email,
          customer.name || 'Customer',
          order._id.toString().slice(-8).toUpperCase(),
          {
            company: shippingDetails.shipping_company,
            trackingId: shippingDetails.tracking_id,
            trackingLink: shippingDetails.tracking_link,
            deliveryType: shippingDetails.delivery_type,
            totalWeight: shippingDetails.total_weight,
            weightUnit: shippingDetails.weight_unit,
            estimatedDelivery: quickPromise(order),
          }
        );
      }
    } catch (emailError: any) {
      logger.error('[quickShop:addShippingDetails] Failed to send tracking email:', emailError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Delivery partner saved. Order is out for delivery.',
      data: { shippingDetails },
    });
  } catch (error: any) {
    next(error);
  }
};

// Legacy only. Filing the delivery partner is what sends a Quick order out now,
// so nothing reaches PICKED_UP any more — this stays so orders already sitting
// there from the old Packed → Picked Up flow can still be moved along.
export const markInTransit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await findOwnQuickOrder(req.user, req.params.orderId);
    if (order.status !== 'PICKED_UP') {
      return next(new AppError(`Cannot mark as in transit from status ${order.status}`, 400));
    }
    const { courier_name, tracking_id } = req.body || {};
    if (courier_name || tracking_id) {
      if (!order.courier) order.courier = {};
      if (courier_name) order.courier.name = String(courier_name).trim();
      if (tracking_id) order.courier.tracking_id = String(tracking_id).trim();
    }
    order.status = 'IN_TRANSIT';
    await order.save();
    res.status(200).json({ success: true, message: 'Order out for delivery', data: { order } });
  } catch (error: any) {
    next(error);
  }
};

export const markDelivered = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await findOwnQuickOrder(req.user, req.params.orderId);
    if (order.status !== 'IN_TRANSIT') {
      return next(new AppError(`Cannot mark as delivered from status ${order.status}`, 400));
    }
    order.status = 'DELIVERED';
    order.deliveredAt = new Date();
    await order.save();

    try {
      const populatedOrder = await order.populate('customer_id');
      const customer = populatedOrder.customer_id as any;
      if (customer?.email) {
        await sendDeliveryCompletedEmail(
          customer.email,
          customer.name || 'Customer',
          `#${order._id.toString().slice(-8)}`,
          new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        );
      }
    } catch (emailError: any) {
      logger.error('[quickShop:markDelivered] Failed to send email:', emailError.message);
    }

    res.status(200).json({ success: true, message: 'Order marked as delivered', data: { order } });
  } catch (error: any) {
    next(error);
  }
};
