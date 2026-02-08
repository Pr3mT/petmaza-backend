import Product from '../models/Product';
import Category from '../models/Category';
import Brand from '../models/Brand';
import User from '../models/User';
import VendorProductPricing from '../models/VendorProductPricing';
import VendorDetails from '../models/VendorDetails';
import { AppError } from '../middlewares/errorHandler';

export class ProductService {
  // Create product
  static async createProduct(data: any) {
    // Validate category exists
    const category = await Category.findById(data.category_id);
    if (!category) {
      throw new AppError('Category not found', 404);
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
        isApproved: true,
      });
      
      if (!primeVendor) {
        throw new AppError('Invalid Prime Vendor selected', 404);
      }
    }

    // Prepare product data
    const productData: any = { ...data };
    
    // Handle variant products
    if (data.hasVariants && data.variants && data.variants.length > 0) {
      // For variant products, don't send legacy price fields or set them to 0
      productData.sellingPrice = 0;
      productData.purchasePrice = 0;
      productData.mrp = 0;
      productData.weight = 0;
      productData.sellingPercentage = 0;
      productData.purchasePercentage = 60;
    } else {
      // For legacy single-weight products, calculate prices
      const sellingPrice = data.mrp * (data.sellingPercentage / 100);
      const purchasePrice = data.mrp * ((data.purchasePercentage || 60) / 100);
      
      productData.sellingPrice = sellingPrice;
      productData.purchasePrice = purchasePrice;
      productData.purchasePercentage = data.purchasePercentage || 60;
    }

    const product = await Product.create(productData);

    return product;
  }

  // Get all products
  static async getAllProducts(filters: {
    category_id?: string;
    brand_id?: string | string[]; // Can be single brand_id or array of brand_ids
    isPrime?: boolean;
    isActive?: boolean;
    pincode?: string; // Filter by availability in pincode
    search?: string; // Search by product name or description
  } = {}) {
    const query: any = {};

    if (filters.category_id) {
      query.category_id = filters.category_id;
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

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    } else {
      query.isActive = true;
    }

    // Add search functionality
    if (filters.search) {
      // Escape special regex characters to prevent regex errors
      const escapedSearch = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    let products = await Product.find(query)
      .populate('category_id', 'name')
      .populate('brand_id', 'name')
      .sort({ createdAt: -1 });

    // Add stock availability information from MY SHOP vendor
    // Get all product IDs
    const productIds = products.map((p) => p._id);
    
    // Add inStock field to each product based on product.isActive and variants
    if (productIds.length > 0) {
      products = products.map((p) => {
        const productObj = p.toObject();
        
        // For variant products, check if product is active and has active variants
        if (productObj.hasVariants && productObj.variants && productObj.variants.length > 0) {
          const hasActiveVariants = productObj.variants.some((v: any) => v.isActive);
          productObj.inStock = productObj.isActive && hasActiveVariants;
        } else {
          // For non-variant products, use product.isActive
          productObj.inStock = productObj.isActive === true;
        }
        
        return productObj;
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

    return products;
  }

  // Get product by ID
  static async getProductById(id: string, pincode?: string) {
    const product = await Product.findById(id)
      .populate('category_id', 'name')
      .populate('brand_id', 'name');

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Determine inStock status based on product type
    let inStock = false;
    
    // For variant products, check if product is active and has active variants
    if (product.hasVariants && product.variants && product.variants.length > 0) {
      const hasActiveVariants = product.variants.some((v: any) => v.isActive);
      inStock = product.isActive && hasActiveVariants;
    } else {
      // For non-variant products, use product.isActive
      inStock = product.isActive === true;
    }

    const productWithStock = {
      ...product.toObject(),
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
  static async updateProduct(id: string, data: {
    name?: string;
    description?: string;
    category_id?: string;
    brand_id?: string;
    weight?: number;
    mrp?: number;
    sellingPercentage?: number;
    isPrime?: boolean;
    images?: string[];
    isActive?: boolean;
  }) {
    // Validate category if provided
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

    // Get existing product to calculate new selling price
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      throw new AppError('Product not found', 404);
    }

    const mrp = data.mrp ?? existingProduct.mrp;
    const sellingPercentage = data.sellingPercentage ?? existingProduct.sellingPercentage;
    const sellingPrice = mrp * (sellingPercentage / 100);

    const product = await Product.findByIdAndUpdate(
      id,
      {
        ...data,
        sellingPrice,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    return product;
  }

  // Delete product (soft delete)
  static async deleteProduct(id: string) {
    const product = await Product.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    return product;
  }
}

