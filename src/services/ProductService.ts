import logger from '../config/logger';
import mongoose from 'mongoose';
import Product from '../models/Product';
import Category from '../models/Category';
import Brand from '../models/Brand';
import User from '../models/User';
import VendorProductPricing from '../models/VendorProductPricing';
import VendorDetails from '../models/VendorDetails';
import { AppError } from '../middlewares/errorHandler';

// ─── Seeded shuffle helpers ───────────────────────────────────────────────────
// Uses a Linear Congruential Generator so the same seed always produces the
// same order — critical for consistent pagination across pages in a session.

/** Returns a pseudo-random number generator seeded with `seed`. */
function seededRandom(seed: number): () => number {
  // LCG parameters (same as Numerical Recipes)
  let s = seed >>> 0; // coerce to unsigned 32-bit
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Fisher-Yates in-place shuffle using a seeded RNG — returns a new array. */
function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const rng = seededRandom(seed);
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
// ─────────────────────────────────────────────────────────────────────────────

export class ProductService {
  // ── In-memory cache for storefront listing (shuffle) responses ──────────────
  // Storefront pages request a shuffled list (filters.seed is set). Without caching,
  // every visitor triggers a full-collection load + Fisher-Yates shuffle — that is
  // what spikes CPU/RAM under load. Instead we shuffle with a SHARED 30-minute
  // time-bucket seed and cache the computed { products, total }, so 100s of visitors
  // in one window share a single computation and the list auto-reshuffles every 30 min.
  private static listingCache = new Map<string, { data: any; expiry: number }>();
  private static listingInflight = new Map<string, Promise<any>>();
  private static readonly LISTING_TTL_MS = 30 * 60 * 1000; // 30 minutes
  private static readonly LISTING_CACHE_MAX = 200;          // cap distinct keys to bound memory

  /** Invalidate the storefront listing cache — call after any product mutation. */
  static clearListingCache() {
    ProductService.listingCache.clear();
    ProductService.listingInflight.clear();
  }

  /**
   * Public entry point for product listings.
   * Storefront "shuffle" requests (filters.seed set) are served from a shared,
   * time-bucketed, in-memory cache so many visitors cost ONE computation per
   * 30-min window. Admin / no-seed requests pass straight through (always fresh).
   */
  static async getAllProducts(filters: any = {}) {
    // Cache PUBLIC storefront reads only: shuffle requests (seed set) OR active-only
    // listings (isActive === true — the controller sets this for customers/public, and
    // undefined for admins). Admin reads and search queries pass straight through fresh.
    const isShuffle = filters.seed !== undefined;
    const isPublicListing = (isShuffle || filters.isActive === true) && !filters.search;
    if (!isPublicListing) {
      return ProductService._getAllProductsUncached(filters);
    }

    // 30-min time bucket: rotates the cache + (for shuffle) the shared seed every 30 min.
    const bucket = Math.floor(Date.now() / ProductService.LISTING_TTL_MS);

    // Shuffle requests get the SHARED bucket seed (same order for everyone); SORTED
    // requests (Featured, Today's Picks, etc.) are left untouched so their order holds.
    const effectiveFilters = isShuffle ? { ...filters, seed: bucket } : filters;

    // Cache key = every result-affecting filter (incl. sort) + bucket. The user's
    // per-session seed is deliberately excluded so all visitors share one entry.
    const key = JSON.stringify({
      cat: filters.category_id ?? null,
      main: filters.mainCategory ?? null,
      sub: filters.subCategory ?? null,
      brand: filters.brand_id ?? null,
      prime: filters.isPrime ?? null,
      active: filters.isActive ?? null,
      min: filters.minPrice ?? null,
      max: filters.maxPrice ?? null,
      disc: filters.discount ?? null,
      sortBy: filters.sortBy ?? null,
      sortOrder: filters.sortOrder ?? null,
      shuffle: isShuffle,
      page: filters.page ?? 1,
      limit: filters.limit ?? null,
      bucket,
    });

    const cached = ProductService.listingCache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    // Stampede protection: collapse concurrent misses for the same key into one compute.
    const inflight = ProductService.listingInflight.get(key);
    if (inflight) return inflight;

    const promise = (async () => {
      const data = await ProductService._getAllProductsUncached(effectiveFilters);
      if (ProductService.listingCache.size >= ProductService.LISTING_CACHE_MAX) {
        const oldest = ProductService.listingCache.keys().next().value; // FIFO-ish eviction
        if (oldest !== undefined) ProductService.listingCache.delete(oldest);
      }
      ProductService.listingCache.set(key, { data, expiry: Date.now() + ProductService.LISTING_TTL_MS });
      return data;
    })();

    ProductService.listingInflight.set(key, promise);
    try {
      return await promise;
    } finally {
      ProductService.listingInflight.delete(key);
    }
  }

  // Create product
  static async createProduct(data: any) {
    // Validate category exists (only if category_id is provided for backward compatibility)
    if (data.category_id) {
      const category = await Category.findById(data.category_id);
      if (!category) {
        throw new AppError('Category not found', 404);
      }
    }

    // Validate brand exists
    const brand = await Brand.findById(data.brand_id);
    if (!brand) {
      throw new AppError('Brand not found', 404);
    }

    // Validate prime vendor if product is prime
    if (data.isPrime) {
      if (!data.primeVendor_id) {
        throw new AppError('Prime Vendor is required for Prime products', 400);
      }
      
      const User = (await import('../models/User')).default;
      const primeVendor = await User.findOne({
        _id: data.primeVendor_id,
        role: 'vendor',
        vendorType: 'PRIME',
        // Removed isApproved check - vendors can create products immediately
      });
      
      if (!primeVendor) {
        throw new AppError('Invalid Prime Vendor selected. Vendor must have role "vendor" and vendorType "PRIME"', 404);
      }
    }

    const product = await Product.create(data);

    ProductService.clearListingCache();
    return product;
  }

  // Get all products
  private static async _getAllProductsUncached(filters: {
    category_id?: string;
    brand_id?: string | string[]; // Can be single brand_id or array of brand_ids
    isPrime?: boolean;
    isActive?: boolean;
    pincode?: string; // Filter by availability in pincode
    search?: string; // Search by product name or description
    mainCategory?: string; // Filter by main category (Dog, Cat, Fish, Bird, Small Animals)
    subCategory?: string; // Filter by subcategory
    page?: number; // Page number for pagination
    limit?: number; // Number of items per page
    seed?: number; // Random seed for consistent shuffle across pages in a session
    sortBy?: string;    // Field to sort by: 'createdAt' | 'soldQuantity' | 'sellingPrice' | 'mrp' | 'name' | 'discount'
    sortOrder?: string; // 'asc' | 'desc'
    minPrice?: number;  // Minimum selling price filter
    maxPrice?: number;  // Maximum selling price filter
    discount?: number;  // Minimum discount percentage filter
  } = {}) {
    const query: any = {};

    if (filters.category_id) {
      query.category_id = filters.category_id;
    }

    // Filter by mainCategory (Pet Type)
    if (filters.mainCategory) {
      query.mainCategory = filters.mainCategory;
    }

    // Filter by subCategory
    if (filters.subCategory) {
      query.subCategory = filters.subCategory;
    }

    if (filters.brand_id) {
      // Handle array of brand_ids using $in operator
      if (Array.isArray(filters.brand_id)) {
        query.brand_id = { $in: filters.brand_id };
      } else {
        query.brand_id = filters.brand_id;
      }
    }

    if (filters.isPrime !== undefined) {
      query.isPrime = filters.isPrime;
    }

    // Price range filter — applied at the DB level so pagination is accurate.
    // We also require sellingPrice > 0 to exclude docs where sellingPrice is null/0
    // (those would otherwise pass a pure $lte query and display wrong prices).
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      const priceCondition: any = { $gt: 0 }; // exclude null / zero selling prices
      if (filters.minPrice !== undefined) priceCondition.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) priceCondition.$lte = filters.maxPrice;
      query.sellingPrice = priceCondition;
    }

    // Minimum discount percentage filter (discount field is pre-computed on Product docs)
    if (filters.discount !== undefined) {
      query.discount = { $gte: filters.discount };
    }

    // Only filter by isActive if explicitly set
    // Admin users can pass undefined to see all products (active and inactive)
    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }
    // If filters.isActive is undefined, don't add any filter - show all products

    // Add search functionality — multi-keyword fuzzy across name, description,
    // mainCategory and subCategory so partial/multi-word queries work correctly.
    if (filters.search) {
      const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const keywords = filters.search.trim().split(/\s+/).filter((k: string) => k.length >= 1);

      // Every keyword must match at least one searchable field (AND of ORs)
      const keywordConditions = keywords.map((kw: string) => ({
        $or: [
          { name: { $regex: escape(kw), $options: 'i' } },
          { description: { $regex: escape(kw), $options: 'i' } },
          { mainCategory: { $regex: escape(kw), $options: 'i' } },
          { subCategory: { $regex: escape(kw), $options: 'i' } },
        ],
      }));

      // Merge with any existing $and conditions
      if (query.$and) {
        query.$and = [...query.$and, ...keywordConditions];
      } else {
        query.$and = keywordConditions;
      }
    }

    // Pagination
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 1000; // Default to large number if not specified
    const skip = (page - 1) * limit;

    let total: number;
    let rawProducts: any[];

    if (filters.seed !== undefined) {
      // ── Seeded shuffle path ────────────────────────────────────────────────
      // Fetch all matching docs (lean, minimal fields) so we can:
      //   1. Determine in-stock status for each product
      //   2. Partition into inStock / outOfStock groups
      //   3. Shuffle each group independently with the same seed
      //   4. Concatenate (inStock first) and paginate
      // This guarantees out-of-stock products always appear at the END of every
      // page, while the order still varies freshly each browsing session.
      // Compute effective in-stock status IN THE DATABASE so we never pull the
      // (potentially large) per-product `variants` arrays across the wire just to
      // partition. Only `{ _id, effectiveInStock }` is returned per matching doc.
      //
      // $match doesn't auto-cast like find(), so cast the ObjectId fields
      // (category_id / brand_id) that the query builder leaves as strings.
      const toOid = (v: any) =>
        typeof v === 'string' && mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : v;
      const matchQuery: any = { ...query };
      if (matchQuery.category_id) matchQuery.category_id = toOid(matchQuery.category_id);
      if (matchQuery.brand_id) {
        if (matchQuery.brand_id.$in) matchQuery.brand_id = { $in: matchQuery.brand_id.$in.map(toOid) };
        else matchQuery.brand_id = toOid(matchQuery.brand_id);
      }

      const allStockDocs: any[] = await Product.aggregate([
        { $match: matchQuery },
        {
          $project: {
            _id: 1,
            effectiveInStock: {
              $and: [
                { $ne: ['$isActive', false] },
                { $ne: ['$inStock', false] },
                {
                  $cond: [
                    // variant product (has a non-empty variants array)?
                    { $and: [{ $eq: ['$hasVariants', true] }, { $isArray: '$variants' }, { $gt: [{ $size: { $ifNull: ['$variants', []] } }, 0] }] },
                    // in stock iff at least one variant is active
                    { $anyElementTrue: { $map: { input: '$variants', as: 'v', in: { $ne: ['$$v.isActive', false] } } } },
                    true,
                  ],
                },
              ],
            },
          },
        },
      ]);

      total = allStockDocs.length;

      // Partition (tiny objects now — no variants payload)
      const inStockDocs: any[] = [];
      const outOfStockDocs: any[] = [];
      for (const doc of allStockDocs) {
        (doc.effectiveInStock ? inStockDocs : outOfStockDocs).push(doc);
      }

      // Shuffle each group with the same seed (use seed+1 for out-of-stock so
      // the two groups don't produce the same sequence)
      const shuffledInStock = shuffleWithSeed(inStockDocs, filters.seed);
      const shuffledOutOfStock = shuffleWithSeed(outOfStockDocs, filters.seed + 1);

      // Concatenate: in-stock first, out-of-stock at the end
      const orderedDocs = [...shuffledInStock, ...shuffledOutOfStock];

      const pagedIds = orderedDocs.slice(skip, skip + limit).map((d: any) => d._id);

      if (pagedIds.length === 0) {
        rawProducts = [];
      } else {
        // Fetch full documents for just this page's IDs
        const fetched = await Product.find({ _id: { $in: pagedIds } })
          .populate('category_id', 'name')
          .populate('brand_id', 'name')
          .populate('primeVendor_id', 'name shopName')
          .lean();

        // Restore the shuffled + partitioned order — MongoDB $in does not preserve insertion order
        const idOrder = pagedIds.map((id: any) => id.toString());
        rawProducts = fetched.sort(
          (a: any, b: any) => idOrder.indexOf(a._id.toString()) - idOrder.indexOf(b._id.toString())
        );
      }
    } else {
      // ── Default path (admin / no-seed) ─────────────────────────────────────
      // Build sort object from filters.sortBy / sortOrder; fallback to createdAt desc
      // for admin panels and backward compat.
      let sortObj: Record<string, 1 | -1> = { createdAt: -1 };
      if (filters.sortBy) {
        const dir: 1 | -1 = filters.sortOrder === 'asc' ? 1 : -1;
        if (filters.sortBy === 'soldQuantity') {
          // Combine all sales metrics for a better "Best Sellers" sort
          sortObj = { soldQuantity: dir, totalSoldWebsite: dir, totalSoldStore: dir };
        } else {
          sortObj = { [filters.sortBy]: dir };
        }
      }
      [total, rawProducts] = await Promise.all([
        Product.countDocuments(query),
        Product.find(query)
          .populate('category_id', 'name')
          .populate('brand_id', 'name')
          .populate('primeVendor_id', 'name shopName')
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);
    }

    let products = rawProducts;

    // Compute inStock for every product:
    // A product is in-stock only when BOTH conditions are true:
    //   1. isActive !== false  — covers legacy products marked out-of-stock via isActive
    //   2. inStock !== false   — covers new products marked out-of-stock via the inStock toggle
    if (products.length > 0) {
      products = products.map((p) => {
        p.inStock = p.isActive !== false && p.inStock !== false;
        return p;
      });
    }

    // Attach vendor shop name for prime products.
    // shopName lives in VendorDetails (separate collection), not in User.
    // Batch-fetch in one query to avoid N+1.
    const primeVendorIds = products
      .filter((p) => p.isPrime && p.primeVendor_id)
      .map((p) => (p.primeVendor_id as any)?._id || p.primeVendor_id);

    if (primeVendorIds.length > 0) {
      const vendorDetailsMap = await VendorDetails.find(
        { vendor_id: { $in: primeVendorIds } },
        { vendor_id: 1, shopName: 1 }
      ).lean();

      const shopNameByVendorId: Record<string, string> = {};
      vendorDetailsMap.forEach((vd) => {
        shopNameByVendorId[vd.vendor_id.toString()] = vd.shopName;
      });

      products = products.map((p) => {
        if (p.isPrime && p.primeVendor_id) {
          const vid = ((p.primeVendor_id as any)?._id || p.primeVendor_id).toString();
          (p as any).vendorShopName = shopNameByVendorId[vid] || null;
        }
        return p;
      });
    }

    // Pincode filter is now optional - products visible from any location
    // if (filters.pincode) {
    //   // Pincode filtering disabled to show all products
    // }
    
    // Return all products without pincode restriction
    if (false && filters.pincode) {
      const productIds = products.map((p) => p._id);
      
      if (productIds.length === 0) {
        return [];
      }

      const vendorPricing = await VendorProductPricing.find({
        product_id: { $in: productIds },
        isActive: true,
        availableStock: { $gt: 0 },
      });

      if (vendorPricing.length === 0) {
        return [];
      }

      const vendorIds = vendorPricing.map((vp) => vp.vendor_id);
      const vendorDetails = await VendorDetails.find({
        vendor_id: { $in: vendorIds },
        serviceablePincodes: filters.pincode,
        isApproved: true,
      });

      if (vendorDetails.length === 0) {
        return [];
      }

      const availableVendorIds = vendorDetails.map((vd) => vd.vendor_id.toString());
      const availableProductIds = vendorPricing
        .filter((vp) => availableVendorIds.includes(vp.vendor_id.toString()))
        .map((vp) => vp.product_id.toString());

      products = products.filter((p) =>
        availableProductIds.includes(p._id.toString())
      );
    }

    return { products, total };
  }

  // Get product by ID
  static async getProductById(id: string, pincode?: string) {
    const product = await Product.findById(id)
      .populate('category_id', 'name')
      .populate('brand_id', 'name')
      .populate('primeVendor_id', 'name shopName email')
      .lean(); // Use lean for better performance

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Determine inStock status based on product type
    // Check BOTH isActive (legacy) and inStock (new toggle) — must be truthy in both
    let inStock = false;
    
    // For variant products, check if product is active and has active variants
    if (product.hasVariants && product.variants && product.variants.length > 0) {
      const hasActiveVariants = product.variants.some((v: any) => v.isActive);
      inStock = product.isActive !== false && product.inStock !== false && hasActiveVariants;
    } else {
      // For non-variant products, use both isActive and inStock
      inStock = product.isActive !== false && product.inStock !== false;
    }

    const productWithStock = {
      ...product,
      inStock,
    };

    // Get vendor pricing if pincode provided
    if (pincode) {
      const vendorPricing = await VendorProductPricing.find({
        product_id: id,
        isActive: true,
      }).populate('vendor_id', 'name vendorType');

      // Filter by serviceable pincodes
      const VendorDetails = (await import('../models/VendorDetails')).default;
      const vendorDetails = await VendorDetails.find({
        vendor_id: { $in: vendorPricing.map((vp) => vp.vendor_id) },
        serviceablePincodes: pincode,
        isApproved: true,
      });

      const availableVendorIds = vendorDetails.map((vd) => vd.vendor_id.toString());
      const availablePricing = vendorPricing.filter((vp) =>
        availableVendorIds.includes(vp.vendor_id.toString())
      );

      return {
        product: productWithStock,
        vendorPricing: availablePricing,
      };
    }

    return { product: productWithStock };
  }

  // Update product
  static async updateProduct(id: string, data: any) {
    logger.info('ProductService.updateProduct called with:', {
      id,
      mainCategory: data.mainCategory,
      subCategory: data.subCategory,
      name: data.name,
      brand_id: data.brand_id,
      hasVariants: data.hasVariants
    });

    // When a product is explicitly deactivated (isActive=false), also mark it out-of-stock
    // so the "Notify Me" feature works correctly (frontend checks inStock field).
    // NOTE: We do NOT auto-reset inStock=true when isActive=true — that would undo a
    // deliberate "Mark Out of Stock" action made via the product list stock toggle.
    if (data.isActive === false && data.inStock === undefined) {
      data.inStock = false;
    }
    
    // Validate category_id only if provided (for backward compatibility)
    if (data.category_id) {
      const category = await Category.findById(data.category_id);
      if (!category) {
        throw new AppError('Category not found', 404);
      }
    }

    // Validate brand if provided
    if (data.brand_id) {
      const brand = await Brand.findById(data.brand_id);
      if (!brand) {
        throw new AppError('Brand not found', 404);
      }
    }

    // Get existing product
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      throw new AppError('Product not found', 404);
    }
    
    logger.info('Existing product:', {
      id: existingProduct._id,
      name: existingProduct.name,
      mainCategory: existingProduct.mainCategory,
      subCategory: existingProduct.subCategory
    });

    // Handle variant products
    if (data.hasVariants || existingProduct.hasVariants) {
      // If updating variants, calculate prices for each variant
      if (data.variants && Array.isArray(data.variants)) {
        // Calculate prices for all variants (including single variant)
        data.variants = data.variants.map((variant: any) => {
          if (variant.mrp !== undefined) variant.mrp = Math.round(variant.mrp);
          if (variant.mrp && variant.sellingPercentage !== undefined) {
              const sp = variant.mrp * (variant.sellingPercentage / 100);
              variant.sellingPrice = Math.round(sp);
              variant.discount = Math.round(((variant.mrp - variant.sellingPrice) / variant.mrp) * 100);
            }
          if (variant.sellingPrice !== undefined) variant.sellingPrice = Math.round(variant.sellingPrice);
            if (variant.mrp && variant.purchasePercentage !== undefined) {
              const pp = variant.mrp * (variant.purchasePercentage / 100);
              variant.purchasePrice = Math.round(pp);
            }
          if (variant.purchasePrice !== undefined) variant.purchasePrice = Math.round(variant.purchasePrice);
          return variant;
        });
        
        logger.info('Updating with variants:', data.variants.length);
      } else if (data.hasVariants === false) {
        // Switching from variant to non-variant product
        logger.info('Converting from variant to non-variant product');
        data.variants = [];
      }
      
      // Update product with explicit $set to replace variants array completely
      const product = await Product.findByIdAndUpdate(
        id, 
        { 
          $set: {
            ...data,
            variants: data.variants || []
          }
        },
        {
          new: true,
          runValidators: true,
        }
      );
      
      logger.info('Variant product updated successfully:', {
        id: product?._id,
        name: product?.name,
        mainCategory: product?.mainCategory,
        subCategory: product?.subCategory,
        variantsCount: product?.variants?.length
      });
      
      return product;
    }

    // Handle single products (no variants)
    const mrp = data.mrp ?? existingProduct.mrp;
    if (mrp) data.mrp = Math.round(mrp);

    // sellingPrice: if a percentage was explicitly sent by the client, derive price from it.
    // Otherwise use the direct sellingPrice value — do NOT fall back to the stored percentage,
    // because that would silently overwrite a price the admin just corrected.
    if (data.sellingPercentage !== undefined && mrp) {
      const sp = mrp * (data.sellingPercentage / 100);
      data.sellingPrice = Math.round(sp);
      data.discount = Math.round(((mrp - data.sellingPrice) / mrp) * 100);
    } else if (data.sellingPrice !== undefined) {
      data.sellingPrice = Math.round(data.sellingPrice);
      if (mrp && data.sellingPrice > 0) {
        data.sellingPercentage = Math.round((data.sellingPrice / mrp) * 100 * 100) / 100;
        data.discount = Math.round(((mrp - data.sellingPrice) / mrp) * 100);
      }
    }

    // purchasePrice: same logic — prefer explicit percentage if sent, otherwise use direct price.
    if (data.purchasePercentage !== undefined && mrp) {
      const pp = mrp * (data.purchasePercentage / 100);
      data.purchasePrice = Math.round(pp);
    } else if (data.purchasePrice !== undefined) {
      data.purchasePrice = Math.round(data.purchasePrice);
      if (mrp && data.purchasePrice > 0) {
        data.purchasePercentage = Math.round((data.purchasePrice / mrp) * 100 * 100) / 100;
      }
    }

    const product = await Product.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    logger.info('Product updated successfully:', {
      id: product?._id,
      name: product?.name,
      mainCategory: product?.mainCategory,
      subCategory: product?.subCategory,
      brand_id: product?.brand_id
    });

    ProductService.clearListingCache();
    return product;
  }

  // Delete product (soft delete)
  static async deleteProduct(id: string) {
    // Permanently delete the product from database
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    ProductService.clearListingCache();
    return product;
  }
}

