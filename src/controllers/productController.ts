import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/ProductService';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import PrimeProduct from '../models/PrimeProduct';
import VendorDetails from '../models/VendorDetails';

export const createProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    
    // Check permissions: Admin, MY_SHOP vendor, or PRIME vendor
    if (user.role !== 'admin' && user.vendorType !== 'MY_SHOP' && user.vendorType !== 'PRIME') {
      return next(new AppError('Only Admin, MY_SHOP, and PRIME vendors can create products', 403));
    }
    
    // For PRIME vendors, auto-set isPrime and primeVendor_id
    let productData = { ...req.body };
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
        stock: product.initialStock || 0,
        minOrderQuantity: 1,
        maxOrderQuantity: 100,
        deliveryTime: '3-5 business days',
        isActive: true,
        isAvailable: true,
        // Use first variant if product has variants
        variant_id: product.hasVariants && product.variants && product.variants.length > 0 
          ? product.variants[0]._id 
          : undefined,
        selectedVariant: product.hasVariants && product.variants && product.variants.length > 0
          ? {
              weight: product.variants[0].weight,
              unit: product.variants[0].unit,
              displayWeight: product.variants[0].displayWeight,
            }
          : undefined,
      });
    }
    
    // If MY_SHOP vendor created the product, auto-create VendorProductPricing entry
    if (user.vendorType === 'MY_SHOP') {
      const VendorProductPricing = (await import('../models/VendorProductPricing')).default;
      
      // For variant products, use the first variant's pricing or average
      let purchasePrice = req.body.purchasePrice;
      let purchasePercentage = req.body.purchasePercentage || 60;
      let initialStock = req.body.initialStock || 0;
      
      if (product.hasVariants && product.variants && product.variants.length > 0) {
        // Use first variant's pricing as default
        const firstVariant = product.variants[0];
        purchasePrice = firstVariant.purchasePrice;
        purchasePercentage = firstVariant.purchasePercentage || 60;
        
        // Create variantStock array with initial stock from variants
        const variantStock = product.variants.map((variant: any, index: number) => {
          const variantData = req.body.variants[index];
          return {
            weight: variant.weight,
            unit: variant.unit,
            displayWeight: variant.displayWeight,
            availableStock: variantData?.initialStock || 0,
            totalSoldWebsite: 0,
            totalSoldStore: 0,
            isActive: variant.isActive || true,
          };
        });
        
        const vendorPricing = await VendorProductPricing.create({
          vendor_id: user._id,
          product_id: product._id,
          purchasePrice: purchasePrice,
          purchasePercentage: purchasePercentage,
          availableStock: 0, // Not used for variant products
          totalSoldWebsite: 0,
          totalSoldStore: 0,
          isActive: req.body.isActive !== undefined ? req.body.isActive : true,
          variantStock: variantStock,
        });
      } else {
        // Single product (non-variant)
        if (!purchasePrice && product.mrp) {
          purchasePrice = product.mrp * (purchasePercentage / 100);
        }
        
        await VendorProductPricing.create({
          vendor_id: user._id,
          product_id: product._id,
          purchasePrice: purchasePrice,
          purchasePercentage: purchasePercentage,
          availableStock: initialStock,
          totalSoldWebsite: 0,
          totalSoldStore: 0,
          isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        });
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
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
    
    // Check permissions: Admin can update any, MY_SHOP can update their own
    if (user.role !== 'admin' && user.vendorType !== 'MY_SHOP') {
      return next(new AppError('Only Admin and MY_SHOP vendors can update products', 403));
    }
    
    // If MY_SHOP vendor, verify they own this product
    if (user.vendorType === 'MY_SHOP') {
      const VendorProductPricing = (await import('../models/VendorProductPricing')).default;
      const vendorProduct = await VendorProductPricing.findOne({
        vendor_id: user._id,
        product_id: req.params.id,
      });
      
      if (!vendorProduct) {
        return next(new AppError('You can only update products you created', 403));
      }
    }
    
    const product = await ProductService.updateProduct(req.params.id, req.body);
    
    // If MY_SHOP vendor and updating stock/pricing fields, update VendorProductPricing
    if (user.vendorType === 'MY_SHOP' && (req.body.availableStock !== undefined || req.body.purchasePrice !== undefined)) {
      const VendorProductPricing = (await import('../models/VendorProductPricing')).default;
      const updateData: any = {};
      
      if (req.body.availableStock !== undefined) updateData.availableStock = req.body.availableStock;
      if (req.body.purchasePrice !== undefined) updateData.purchasePrice = req.body.purchasePrice;
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
      
      await VendorProductPricing.findOneAndUpdate(
        { vendor_id: user._id, product_id: req.params.id },
        updateData,
        { new: true }
      );
    }
    
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
    const product = await ProductService.deleteProduct(req.params.id);
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
    const products = await ProductService.getProducts({ 
      filter: productFilter 
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
