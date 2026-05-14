/**
 * validateCartPrices.ts
 *
 * SECURITY MIDDLEWARE — Server-side cart price & stock validation.
 *
 * Why this exists:
 *   Prices shown to the user in the browser can be tampered with via DevTools,
 *   proxy intercepts, or crafted API requests. This middleware re-fetches every
 *   product price from the DB, recalculates the true subtotal, and attaches
 *   `req.validatedCart` so downstream controllers always use DB-authoritative
 *   values — never the frontend-supplied ones.
 *
 * Attaches to req:
 *   req.validatedCart.items   — array of items with DB prices
 *   req.validatedCart.serverSubtotal — server-computed subtotal (before discounts/shipping)
 */

import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product';
import { AuthRequest } from './auth';
import { AppError } from './errorHandler';
import { logSecurityEvent } from '../utils/paymentSecurityLogger';
import logger from '../config/logger';

const MAX_ITEMS_PER_ORDER = 50;
const MAX_QUANTITY_PER_ITEM = 100;

export interface ValidatedCartItem {
  product_id: string;
  quantity: number;
  sellingPrice: number;
  purchasePrice: number;
  subtotal: number;
  purchaseSubtotal: number;
  selectedVariant?: any;
}

export interface ValidatedCart {
  items: ValidatedCartItem[];
  serverSubtotal: number;
}

/**
 * Validates cart items against DB prices and stock.
 * Blocks the request if any price, stock, or availability check fails.
 * Attaches `req.validatedCart` for use by createOrder.
 */
export const validateCartPrices = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      next(new AppError('Cart items are required', 400));
      return;
    }

    if (items.length > MAX_ITEMS_PER_ORDER) {
      next(new AppError(`Too many items in cart. Maximum allowed: ${MAX_ITEMS_PER_ORDER}`, 400));
      return;
    }

    const validatedItems: ValidatedCartItem[] = [];
    let serverSubtotal = 0;

    // Batch-fetch all products at once for efficiency
    const productIds = items.map((item: any) => item.product_id).filter(Boolean);
    const uniqueProductIds = [...new Set(productIds.map(String))];

    if (uniqueProductIds.length !== items.length) {
      next(new AppError('Duplicate or missing product IDs in cart', 400));
      return;
    }

    // Validate all IDs are valid ObjectIds before querying
    for (const pid of uniqueProductIds) {
      if (!mongoose.Types.ObjectId.isValid(pid)) {
        next(new AppError(`Invalid product ID: ${pid}`, 400));
        return;
      }
    }

    const products = await Product.find({ _id: { $in: uniqueProductIds } }).select(
      'name sellingPrice purchasePrice isActive inStock stock variants hasVariants isPrime minOrderQuantity maxOrderQuantity'
    );

    const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));

    for (const item of items) {
      const { product_id, quantity, selectedVariant } = item;

      // ── Basic field validation ──────────────────────────────────────────
      if (!product_id) {
        next(new AppError('Each cart item must have a product_id', 400));
        return;
      }

      if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
        next(new AppError('Quantity must be a positive integer', 400));
        return;
      }

      const qty = Number(quantity);

      if (qty > MAX_QUANTITY_PER_ITEM) {
        await logSecurityEvent({
          event: 'SUSPICIOUS_QUANTITY',
          severity: 'MEDIUM',
          userId: req.user?._id,
          ipAddress: req.ip ?? req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
          details: `Suspiciously large quantity ${qty} for product ${product_id}`,
          received: qty,
          expected: `<= ${MAX_QUANTITY_PER_ITEM}`,
        });
        next(new AppError(`Quantity ${qty} exceeds the allowed maximum per item`, 400));
        return;
      }

      // ── Product existence & availability ───────────────────────────────
      const product = productMap.get(product_id.toString()) as any;

      if (!product) {
        next(new AppError(`Product not found: ${product_id}`, 404));
        return;
      }

      if (!product.isActive) {
        next(new AppError(`"${product.name}" is no longer available`, 400));
        return;
      }

      // ── Resolve server-side price from DB ─────────────────────────────
      // SECURITY: prices come from DB only — never from req.body
      let sellingPrice: number;
      let purchasePrice: number;

      if (product.hasVariants && product.variants?.length > 0) {
        // Must specify a variant; match by _id, size, or weight+unit
        const variant = matchVariant(product.variants, selectedVariant);

        if (!variant) {
          next(new AppError(`Could not find the selected variant for "${product.name}". Please re-select.`, 400));
          return;
        }

        if (variant.isActive === false) {
          next(new AppError(`Selected variant of "${product.name}" is no longer available`, 400));
          return;
        }

        sellingPrice = resolveVariantSellingPrice(variant);
        purchasePrice = resolveVariantPurchasePrice(variant, sellingPrice);
      } else {
        // Simple (non-variant) product
        sellingPrice = product.sellingPrice ?? 0;
        purchasePrice = product.purchasePrice ?? 0;
      }

      if (!sellingPrice || sellingPrice <= 0) {
        next(new AppError(`Selling price not set for "${product.name}". Please contact support.`, 400));
        return;
      }

      // Note: numeric stock enforcement is handled by OrderRoutingService.
      // This middleware focuses solely on price validation.

      // ── Quantity bounds (from product config) ─────────────────────────
      if (product.minOrderQuantity && qty < product.minOrderQuantity) {
        next(new AppError(`Minimum order quantity for "${product.name}" is ${product.minOrderQuantity}`, 400));
        return;
      }
      if (product.maxOrderQuantity && qty > product.maxOrderQuantity) {
        next(new AppError(`Maximum order quantity for "${product.name}" is ${product.maxOrderQuantity}`, 400));
        return;
      }

      const subtotal = Math.round(sellingPrice * qty * 100) / 100;
      const purchaseSubtotal = Math.round(purchasePrice * qty * 100) / 100;
      serverSubtotal += subtotal;

      validatedItems.push({
        product_id: product_id.toString(),
        quantity: qty,
        sellingPrice,
        purchasePrice,
        subtotal,
        purchaseSubtotal,
        selectedVariant: selectedVariant ?? undefined,
      });
    }

    logger.info(
      `[validateCartPrices] ✅ Cart validated: ${validatedItems.length} item(s), ` +
        `server subtotal ₹${serverSubtotal.toFixed(2)} | User: ${req.user?._id ?? 'unknown'}`
    );

    // Attach to request for downstream controllers
    (req as any).validatedCart = { items: validatedItems, serverSubtotal } as ValidatedCart;

    next();
  } catch (error: any) {
    next(new AppError(error.message || 'Cart validation failed', 500));
  }
};

// ─── Private helpers ──────────────────────────────────────────────────────────

function matchVariant(variants: any[], selectedVariant: any): any | null {
  if (!selectedVariant) return null;

  if (selectedVariant._id) {
    const byId = variants.find((v: any) => v?._id?.toString() === selectedVariant._id?.toString());
    if (byId) return byId;
  }
  if (selectedVariant.size) {
    const bySize = variants.find((v: any) => v?.size === selectedVariant.size);
    if (bySize) return bySize;
  }
  if (selectedVariant.weight !== undefined && selectedVariant.unit) {
    const byWeight = variants.find(
      (v: any) => v?.weight === selectedVariant.weight && v?.unit === selectedVariant.unit
    );
    if (byWeight) return byWeight;
  }
  if (selectedVariant.displayWeight) {
    return variants.find((v: any) => v?.displayWeight === selectedVariant.displayWeight) ?? null;
  }
  return null;
}

function resolveVariantSellingPrice(variant: any): number {
  if (variant.sellingPrice) return variant.sellingPrice;
  if (variant.mrp && variant.sellingPercentage) {
    return Math.round((variant.mrp * (variant.sellingPercentage / 100)) * 100) / 100;
  }
  return 0;
}

function resolveVariantPurchasePrice(variant: any, fallback: number): number {
  if (variant.purchasePrice) return variant.purchasePrice;
  if (variant.mrp && variant.purchasePercentage) {
    return Math.round((variant.mrp * (variant.purchasePercentage / 100)) * 100) / 100;
  }
  return fallback;
}
