import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/ProductService';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import Product from '../models/Product';
import Brand from '../models/Brand';
import PrimeProduct from '../models/PrimeProduct';
import VendorDetails from '../models/VendorDetails';
import { clearCache } from '../middlewares/cache';
import { notifyWaitingCustomers } from './productNotificationController';

export const createProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    
    // Check permissions: Admin or any vendor type (MY_SHOP, PRIME, WAREHOUSE_FULFILLER)
    if (user.role !== 'admin' && !['MY_SHOP', 'PRIME', 'WAREHOUSE_FULFILLER'].includes(user.vendorType)) {
      return next(new AppError('Only Admin and vendors can create products', 403));
    }
    
    // For PRIME vendors, auto-set isPrime and primeVendor_id
    let productData = { 
      ...req.body,
      addedBy: user._id // Track who created the product
    };
    if (user.vendorType === 'PRIME') {
      productData.isPrime = true;
      productData.primeVendor_id = user._id;
    }
    
    const product = await ProductService.createProduct(productData);
    
    // If PRIME vendor created the product, auto-create PrimeProduct listing
    if (user.vendorType === 'PRIME') {
      // Create initial PrimeProduct listing for their own product
      await PrimeProduct.create({
        vendor_id: user._id,
        product_id: product._id,
        vendorMRP: product.mrp || (product.variants && product.variants.length > 0 ? product.variants[0].mrp : 0),
        vendorPrice: product.sellingPrice || (product.variants && product.variants.length > 0 ? product.variants[0].sellingPrice : 0),
        stock: 0,
        minOrderQuantity: 1,
        maxOrderQuantity: 100,
        deliveryTime: '3-5 business days',
        isActive: true,
        isAvailable: true,
        // Use first variant if product has variants
        variant_id: undefined,
        selectedVariant: product.hasVariants && product.variants && product.variants.length > 0
          ? {
              weight: product.variants[0].weight,
              unit: product.variants[0].unit,
              displayWeight: product.variants[0].displayWeight,
            }
          : undefined,
      });
    }
    
    // Clear product cache so customers see the new product immediately
    clearCache('/products');
    
    // VendorProductPricing removed - all data now in Products collection
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { category_id, brand_id, isPrime, pincode, search, mainCategory, subCategory, page, limit } = req.query;

    const filters: any = {};
    if (category_id) filters.category_id = category_id as string;
    if (brand_id) {
      // Handle comma-separated brand_ids or array
      const brandIds = typeof brand_id === 'string' 
        ? brand_id.split(',').map(id => id.trim()).filter(id => id)
        : Array.isArray(brand_id) 
          ? brand_id 
          : [brand_id];
      filters.brand_id = brandIds.length === 1 ? brandIds[0] : brandIds;
    }
    if (isPrime !== undefined) filters.isPrime = isPrime === 'true';
    if (pincode) filters.pincode = pincode as string;
    if (search) filters.search = search as string;
    if (mainCategory) filters.mainCategory = mainCategory as string;
    if (subCategory) filters.subCategory = subCategory as string;
    if (page) filters.page = parseInt(page as string);
    if (limit) filters.limit = parseInt(limit as string);

    // Debug logging
    console.log('🔍 getProducts - User Info:', {
      hasUser: !!req.user,
      userRole: req.user?.role,
      userEmail: req.user?.email,
      isAdmin: req.user && req.user.role === 'admin'
    });

    // All users (admin, customers, public) see all products.
    // Out-of-stock products remain visible with an "Out of Stock" badge and "Notify Me" button.
    // The inStock field (derived from legacy isActive for old docs) controls purchase availability.
    // But for Prime products: only show those that still have an active PrimeProduct listing
    if (req.user && req.user.role === 'admin') {
      // Admin sees everything (including inactive)
      filters.isActive = undefined;
      console.log('✅ Admin detected - showing all products');
    } else {
      // Customers see only active products
      filters.isActive = true;
      console.log('👤 Customer/public - showing active products only');
    }

    const products = await ProductService.getAllProducts(filters);
    res.status(200).json({
      success: true,
      data: { 
        products,
        page: filters.page || 1,
        limit: filters.limit || products.length,
        hasMore: products.length === (filters.limit || products.length)
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { pincode } = req.query;

    const result = await ProductService.getProductById(id, pincode as string);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    
    // Check permissions: Admin can update any, vendors can update their own
    if (user.role !== 'admin' && user.vendorType !== 'MY_SHOP' && user.vendorType !== 'WAREHOUSE_FULFILLER') {
      return next(new AppError('Only Admin and vendors can update products', 403));
    }
    
    // If vendor, verify they own this product (check addedBy field)
    if (user.role === 'vendor') {
      const existingProduct = await Product.findById(req.params.id);
      if (!existingProduct) {
        return next(new AppError('Product not found', 404));
      }
      
      if (existingProduct.addedBy?.toString() !== user._id.toString()) {
        return next(new AppError('You can only update products you created', 403));
      }
    }
    
    // Get the existing product to check if status changed
    const existingProduct = await Product.findById(req.params.id);
    const wasInactive = existingProduct && !existingProduct.isActive;
    const wasOutOfStock = existingProduct && existingProduct.inStock === false;
    
    const product = await ProductService.updateProduct(req.params.id, req.body);
    
    // If product was inactive/out-of-stock and now is active/in-stock, notify waiting customers
    if ((wasInactive && product.isActive) || (wasOutOfStock && product.inStock !== false)) {
      console.log('🔔 Product became active - checking for waiting customers');
      // Run notification in background (don't await)
      notifyWaitingCustomers(
        product._id.toString(),
        product.name,
        product.images && product.images.length > 0 ? product.images[0] : undefined
      ).catch(err => console.error('Error notifying customers:', err));
    }
    
    // Clear product cache so customers see the updated product immediately
    clearCache('/products');
    
    // VendorProductPricing removed - all data now in Products collection
    
    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product },
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Vendors can only delete products they created
    if (req.user.role === 'vendor') {
      const existingProduct = await Product.findById(req.params.id);
      if (!existingProduct) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      if (!existingProduct.addedBy || existingProduct.addedBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'You can only delete products you created' });
      }
    }

    // Also delete any PrimeProduct listings that reference this product
    await PrimeProduct.deleteMany({ product_id: req.params.id });

    const product = await ProductService.deleteProduct(req.params.id);
    
    // Clear product cache so customers don't see the deleted product
    clearCache('/products');
    
    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: { product },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get Prime Listings for a Product
 * Returns all prime vendor listings for a specific product
 */
export const getPrimeListingsForProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const { variantId } = req.query;

    // Build query
    const query: any = { 
      product_id: productId, 
      isActive: true, 
      isAvailable: true 
    };

    if (variantId) {
      query.variant_id = variantId;
    }

    // Get prime listings with vendor details
    const primeListings = await PrimeProduct.find(query)
      .populate('product_id', 'name images category subcategory')
      .populate({
        path: 'vendor_id',
        select: 'name shopName email phone',
      })
      .sort({ vendorPrice: 1 }); // Sort by price ascending

    // Get vendor details for each listing
    const listingsWithVendorDetails = await Promise.all(
      primeListings.map(async (listing) => {
        const vendorDetails = await VendorDetails.findOne({ 
          vendor_id: listing.vendor_id 
        }).select('rating totalOrders averageDeliveryTime returnPolicy shopName');

        return {
          ...listing.toObject(),
          vendorDetails,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: listingsWithVendorDetails,
      count: listingsWithVendorDetails.length,
    });

  } catch (error: any) {
    next(error);
  }
};

/**
 * Get Prime Products by Category
 * Browse all prime products in a category with vendor information
 */
export const getPrimeProductsByCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, subcategory } = req.query;
    const { 
      page = 1, 
      limit = 20,
      minPrice,
      maxPrice,
      sortBy = 'vendorPrice',
      sortOrder = 'asc',
    } = req.query;

    if (!category) {
      return next(new AppError('Category is required', 400));
    }

    // Build product filter
    const productFilter: any = { category };
    if (subcategory) {
      productFilter.subcategory = subcategory;
    }

    // Find products matching category
    const products = await ProductService.getAllProducts({ 
      mainCategory: productFilter.category,
      subCategory: productFilter.subcategory
    });

    const productIds = products.map((p: any) => p._id);

    // Build prime product query
    const primeQuery: any = {
      product_id: { $in: productIds },
      isActive: true,
      isAvailable: true,
    };

    if (minPrice) primeQuery.vendorPrice = { $gte: Number(minPrice) };
    if (maxPrice) {
      primeQuery.vendorPrice = primeQuery.vendorPrice 
        ? { ...primeQuery.vendorPrice, $lte: Number(maxPrice) }
        : { $lte: Number(maxPrice) };
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    // Get prime listings
    const primeProducts = await PrimeProduct.find(primeQuery)
      .populate('product_id', 'name images category subcategory')
      .populate('vendor_id', 'name shopName')
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    const total = await PrimeProduct.countDocuments(primeQuery);

    // Get vendor details for each listing
    const productsWithVendorDetails = await Promise.all(
      primeProducts.map(async (listing) => {
        const vendorDetails = await VendorDetails.findOne({ 
          vendor_id: listing.vendor_id 
        }).select('rating totalOrders averageDeliveryTime shopName');

        return {
          ...listing.toObject(),
          vendorDetails,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: productsWithVendorDetails,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });

  } catch (error: any) {
    next(error);
  }
};

// ─── Bulk Product Upload ──────────────────────────────────────────────────────

const VALID_MAIN_CATEGORIES = ['Dog', 'Cat', 'Fish', 'Bird', 'Small Animals'];
const REQUIRED_COLUMNS = [
  'product_name', 'brand_name', 'main_category', 'sub_category',
  'mrp', 'purchase_price', 'selling_price', 'status',
];

interface BulkRow {
  product_name: string;
  brand_name: string;
  main_category: string;
  sub_category: string;
  mrp: string;
  purchase_price: string;
  selling_price: string;
  status: string;
  image_url: string;
  // optional fields
  description?: string;
  weight?: string;
  weight_unit?: string;
  size?: string;
  profit_margin?: string;
  vendor_type?: string;
}

interface RowError {
  row: number;
  product_name: string;
  errors: string[];
}

// ─── Default images per main category (used when vendor leaves image_url blank) ──
const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  'Dog':           'https://placehold.co/400x400/FFF3E0/5D4037?text=Dog+Product',
  'Cat':           'https://placehold.co/400x400/F3E5F5/6A1B9A?text=Cat+Product',
  'Fish':          'https://placehold.co/400x400/E3F2FD/0D47A1?text=Fish+Product',
  'Bird':          'https://placehold.co/400x400/E8F5E9/1B5E20?text=Bird+Product',
  'Small Animals': 'https://placehold.co/400x400/FBE9E7/BF360C?text=Small+Animal',
};

export const bulkUploadProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;

    if (user.role !== 'admin') {
      return next(new AppError('Only admins can perform bulk product uploads', 403));
    }

    // Accept JSON array of rows from frontend (frontend already parses the CSV)
    const records: BulkRow[] = req.body?.rows;
    if (!Array.isArray(records) || records.length === 0) {
      return next(new AppError('No product rows provided', 400));
    }

    // Pre-load all brands into a map for efficient lookup
    const allBrands = await Brand.find({}).select('_id name');
    const brandMap = new Map<string, string>(); // name (lowercase) -> _id
    allBrands.forEach(b => brandMap.set(b.name.trim().toLowerCase(), b._id.toString()));

    const successProducts: any[] = [];
    const rowErrors: RowError[] = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // 1-based, +1 for header row
      const errors: string[] = [];

      // Required field checks
      REQUIRED_COLUMNS.forEach(col => {
        const value = (row as any)[col];
        if (!value || String(value).trim() === '') {
          errors.push(`'${col}' is required`);
        }
      });

      if (errors.length > 0) {
        rowErrors.push({ row: rowNum, product_name: row.product_name || '', errors });
        continue;
      }

      // Field-level validation
      const mrp = parseFloat(row.mrp);
      if (isNaN(mrp) || mrp < 0) errors.push("'mrp' must be a non-negative number");

      const purchasePrice = parseFloat(row.purchase_price);
      if (isNaN(purchasePrice) || purchasePrice < 0) errors.push("'purchase_price' must be a non-negative number");

      const sellingPrice = parseFloat(row.selling_price);
      if (isNaN(sellingPrice) || sellingPrice < 0) errors.push("'selling_price' must be a non-negative number");

      const mainCat = row.main_category.trim();
      if (!VALID_MAIN_CATEGORIES.includes(mainCat)) {
        errors.push(`'main_category' must be one of: ${VALID_MAIN_CATEGORIES.join(', ')}`);
      }

      const statusVal = row.status.trim().toLowerCase();
      if (!['active', 'inactive'].includes(statusVal)) {
        errors.push("'status' must be 'Active' or 'Inactive'");
      }

      const weight = row.weight ? parseFloat(row.weight) : undefined;
      if (row.weight && isNaN(weight!)) errors.push("'weight' must be a number");

      const validWeightUnits = ['g', 'kg', 'ml', 'l'];
      if (row.weight_unit && !validWeightUnits.includes(row.weight_unit.trim().toLowerCase())) {
        errors.push(`'weight_unit' must be one of: ${validWeightUnits.join(', ')}`);
      }

      // Brand lookup
      const brandId = brandMap.get(row.brand_name.trim().toLowerCase());
      if (!brandId) {
        errors.push(`Brand '${row.brand_name}' not found in database`);
      }

      if (errors.length > 0) {
        rowErrors.push({ row: rowNum, product_name: row.product_name || '', errors });
        continue;
      }

      // Build product document
      const purchasePct = mrp > 0 ? Math.round((purchasePrice / mrp) * 100) : 60;
      const sellingPct = mrp > 0 ? Math.round((sellingPrice / mrp) * 100) : 80;

      const productData: any = {
        name: row.product_name.trim(),
        brand_id: brandId,
        mainCategory: mainCat,
        subCategory: row.sub_category.trim(),
        isPrime: false,
        mrp,
        purchasePrice,
        purchasePercentage: purchasePct,
        sellingPrice,
        sellingPercentage: sellingPct,
        isActive: statusVal === 'active',
        addedBy: user._id,
        images: row.image_url && row.image_url.trim()
          ? [row.image_url.trim()]
          : [CATEGORY_DEFAULT_IMAGES[mainCat] || 'https://placehold.co/400x400/e8f4ea/333333?text=Product+Image'],
      };

      if (row.description?.trim()) productData.description = row.description.trim();
      if (weight !== undefined && !isNaN(weight)) {
        const unit = (row.weight_unit?.trim().toLowerCase() || 'g') as 'g' | 'kg' | 'ml' | 'l';
        productData.weight = weight;
        productData.unit = unit;
        productData.displayWeight = `${weight}${unit}`;
      }
      if (row.size?.trim()) {
        productData.hasVariants = true;
        productData.variants = [{
          size: row.size.trim(),
          weight: weight,
          unit: row.weight_unit?.trim().toLowerCase() || 'g',
          mrp,
          sellingPrice,
          sellingPercentage: sellingPct,
          purchasePrice,
          purchasePercentage: purchasePct,
          isActive: statusVal === 'active',
        }];
      }

      // Store vendor_type raw value for post-insert assignment
      successProducts.push({ ...productData, _vendorRaw: row.vendor_type?.trim() || '' });
    }

    // Bulk insert valid products
    let insertedCount = 0;
    const insertErrors: RowError[] = [];

    if (successProducts.length > 0) {
      const results = await Promise.allSettled(
        successProducts.map(p => Product.create(p))
      );

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          insertedCount++;
          // Vendor assignment: assign product to vendor(s) based on vendor_type value
          const vendorRaw: string = successProducts[idx]._vendorRaw || '';
          const insertedProduct = (result as PromiseFulfilledResult<any>).value;
          if (vendorRaw) {
            const vendorTypeCodes = ['PRIME', 'MY_SHOP', 'WAREHOUSE_FULFILLER'];
            if (vendorTypeCodes.includes(vendorRaw.toUpperCase())) {
              // Assign to all approved vendors of that type
              (async () => {
                try {
                  const User = require('../models/User').default || require('../models/User');
                  const vendors = await User.find({ role: 'vendor', vendorType: vendorRaw.toUpperCase(), isApproved: true }).select('_id');
                  for (const v of vendors) {
                    const VPP = require('../models/VendorProductPricing').default || require('../models/VendorProductPricing');
                    await VPP.create({ vendor_id: v._id, product_id: insertedProduct._id }).catch(() => {});
                  }
                } catch (_) {}
              })();
            } else {
              // Assign to specific vendor by name or email
              (async () => {
                try {
                  const User = require('../models/User').default || require('../models/User');
                  const vendor = await User.findOne({
                    role: 'vendor',
                    isApproved: true,
                    $or: [
                      { name: { $regex: new RegExp(vendorRaw, 'i') } },
                      { email: { $regex: new RegExp(vendorRaw, 'i') } },
                    ],
                  }).select('_id');
                  if (vendor) {
                    const VPP = require('../models/VendorProductPricing').default || require('../models/VendorProductPricing');
                    await VPP.create({ vendor_id: vendor._id, product_id: insertedProduct._id }).catch(() => {});
                  }
                } catch (_) {}
              })();
            }
          }
        } else if (result.status === 'rejected') {
          const rejected = result as PromiseRejectedResult;
          insertErrors.push({
            row: -1,
            product_name: successProducts[idx].name,
            errors: [rejected.reason?.message || 'Database insert failed'],
          });
        }
      });
    }

    const allErrors = [...rowErrors, ...insertErrors];

    // Clear product cache after bulk insert
    if (insertedCount > 0) {
      clearCache('/products');
    }

    res.status(200).json({
      success: true,
      data: {
        successCount: insertedCount,
        failedCount: allErrors.length,
        totalRows: records.length,
        errors: allErrors,
      },
      message: `Bulk upload complete: ${insertedCount} products added, ${allErrors.length} failed.`,
    });

  } catch (error: any) {
    next(error);
  }
};
