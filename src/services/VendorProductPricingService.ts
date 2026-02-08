import VendorProductPricing from '../models/VendorProductPricing';
import Product from '../models/Product';
import User from '../models/User';
import VendorDetails from '../models/VendorDetails';
import Brand from '../models/Brand';
import { AppError } from '../middlewares/errorHandler';

export class VendorProductPricingService {
  // Assign product to vendor with purchase percentage
  static async assignProductToVendor(data: {
    vendor_id: string;
    product_id: string;
    purchasePercentage: number;
    availableStock: number;
  }) {
    // Validate vendor exists and is approved
    const vendor = await User.findById(data.vendor_id);
    if (!vendor || vendor.role !== 'vendor') {
      throw new AppError('Vendor not found', 404);
    }

    const vendorDetails = await VendorDetails.findOne({ vendor_id: data.vendor_id });
    if (!vendorDetails || !vendorDetails.isApproved) {
      throw new AppError('Vendor not approved', 400);
    }

    // Validate product exists
    const product = await Product.findById(data.product_id);
    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Calculate purchase price
    const purchasePrice = product.mrp * (data.purchasePercentage / 100);

    // Check if pricing already exists
    const existing = await VendorProductPricing.findOne({
      vendor_id: data.vendor_id,
      product_id: data.product_id,
    });

    if (existing) {
      // Update existing
      existing.purchasePercentage = data.purchasePercentage;
      existing.purchasePrice = purchasePrice;
      existing.availableStock = data.availableStock;
      existing.isActive = true;
      await existing.save();
      return existing;
    }

    // Create new
    const vendorProductPricing = await VendorProductPricing.create({
      ...data,
      purchasePrice,
    });

    return vendorProductPricing;
  }

  // Get all products for a vendor
  static async getVendorProducts(vendor_id: string) {
    const vendorProducts = await VendorProductPricing.find({ vendor_id })
      .populate('product_id')
      .sort({ createdAt: -1 });

    return vendorProducts;
  }

  // Get all vendors for a product
  static async getProductVendors(product_id: string, pincode?: string) {
    const query: any = {
      product_id,
      isActive: true,
      availableStock: { $gt: 0 },
    };

    let vendorPricing = await VendorProductPricing.find(query)
      .populate('vendor_id', 'name vendorType')
      .sort({ purchasePrice: 1 }); // Sort by lowest purchase price first

    // Filter by serviceable pincodes if provided
    if (pincode) {
      const vendorIds = vendorPricing.map((vp) => vp.vendor_id);
      const vendorDetails = await VendorDetails.find({
        vendor_id: { $in: vendorIds },
        serviceablePincodes: pincode,
        isApproved: true,
      });

      const availableVendorIds = vendorDetails.map((vd) => vd.vendor_id.toString());
      vendorPricing = vendorPricing.filter((vp) =>
        availableVendorIds.includes(vp.vendor_id.toString())
      );
    }

    return vendorPricing;
  }

  // Update vendor product pricing
  static async updateVendorProductPricing(
    vendor_id: string,
    product_id: string,
    data: {
      purchasePercentage?: number;
      availableStock?: number;
      isActive?: boolean;
    }
  ) {
    const vendorProductPricing = await VendorProductPricing.findOne({
      vendor_id,
      product_id,
    });

    if (!vendorProductPricing) {
      throw new AppError('Vendor product pricing not found', 404);
    }

    // Recalculate purchase price if percentage changed
    if (data.purchasePercentage !== undefined) {
      const product = await Product.findById(product_id);
      if (!product) {
        throw new AppError('Product not found', 404);
      }
      vendorProductPricing.purchasePercentage = data.purchasePercentage;
      vendorProductPricing.purchasePrice = product.mrp * (data.purchasePercentage / 100);
    }

    if (data.availableStock !== undefined) {
      vendorProductPricing.availableStock = data.availableStock;
    }

    if (data.isActive !== undefined) {
      vendorProductPricing.isActive = data.isActive;
    }

    await vendorProductPricing.save();
    return vendorProductPricing;
  }

  // Remove product from vendor
  static async removeProductFromVendor(vendor_id: string, product_id: string) {
    const vendorProductPricing = await VendorProductPricing.findOneAndUpdate(
      { vendor_id, product_id },
      { isActive: false },
      { new: true }
    );

    if (!vendorProductPricing) {
      throw new AppError('Vendor product pricing not found', 404);
    }

    return vendorProductPricing;
  }

  // Assign brands to vendor - automatically assigns all products under those brands
  static async assignBrandsToVendor(data: {
    vendor_id: string;
    brand_ids: string[];
    purchasePercentage: number;
    availableStock?: number;
  }) {
    // Validate vendor exists and is approved
    const vendor = await User.findById(data.vendor_id);
    if (!vendor || (vendor.role !== 'vendor' && vendor.role !== 'retail_vendor' && vendor.role !== 'special_vendor')) {
      throw new AppError('Vendor not found', 404);
    }

    const vendorDetails = await VendorDetails.findOne({ vendor_id: data.vendor_id });
    if (!vendorDetails || !vendorDetails.isApproved) {
      throw new AppError('Vendor not approved', 400);
    }

    // Validate brands exist
    const brands = await Brand.find({ _id: { $in: data.brand_ids }, isActive: true });
    if (brands.length !== data.brand_ids.length) {
      throw new AppError('One or more brands not found or inactive', 404);
    }

    // Find all products under these brands
    const products = await Product.find({
      brand_id: { $in: data.brand_ids },
      isActive: true,
    });

    if (products.length === 0) {
      throw new AppError('No active products found under selected brands', 404);
    }

    // Create/update VendorProductPricing entries for all products
    const assignments = [];
    for (const product of products) {
      const purchasePrice = product.mrp * (data.purchasePercentage / 100);

      const existing = await VendorProductPricing.findOne({
        vendor_id: data.vendor_id,
        product_id: product._id,
      });

      if (existing) {
        // Update existing
        existing.purchasePercentage = data.purchasePercentage;
        existing.purchasePrice = purchasePrice;
        if (data.availableStock !== undefined) {
          existing.availableStock = data.availableStock;
        }
        existing.isActive = true;
        await existing.save();
        assignments.push(existing);
      } else {
        // Create new
        const vendorProductPricing = await VendorProductPricing.create({
          vendor_id: data.vendor_id,
          product_id: product._id,
          purchasePercentage: data.purchasePercentage,
          purchasePrice,
          availableStock: data.availableStock || 0,
          isActive: true,
        });
        assignments.push(vendorProductPricing);
      }
    }

    return {
      assignedCount: assignments.length,
      assignments,
      brands: brands.map(b => ({ _id: b._id, name: b.name })),
    };
  }

  // Assign specific products to vendor
  static async assignProductsToVendor(data: {
    vendor_id: string;
    product_ids: string[];
    purchasePercentage: number;
    availableStock?: number;
  }) {
    // Validate vendor exists and is approved
    const vendor = await User.findById(data.vendor_id);
    if (!vendor || (vendor.role !== 'vendor' && vendor.role !== 'retail_vendor' && vendor.role !== 'special_vendor')) {
      throw new AppError('Vendor not found', 404);
    }

    const vendorDetails = await VendorDetails.findOne({ vendor_id: data.vendor_id });
    if (!vendorDetails || !vendorDetails.isApproved) {
      throw new AppError('Vendor not approved', 400);
    }

    // Validate products exist
    const products = await Product.find({
      _id: { $in: data.product_ids },
      isActive: true,
    });

    if (products.length !== data.product_ids.length) {
      throw new AppError('One or more products not found or inactive', 404);
    }

    // Create/update VendorProductPricing entries
    const assignments = [];
    for (const product of products) {
      const purchasePrice = product.mrp * (data.purchasePercentage / 100);

      const existing = await VendorProductPricing.findOne({
        vendor_id: data.vendor_id,
        product_id: product._id,
      });

      if (existing) {
        // Update existing
        existing.purchasePercentage = data.purchasePercentage;
        existing.purchasePrice = purchasePrice;
        if (data.availableStock !== undefined) {
          existing.availableStock = data.availableStock;
        }
        existing.isActive = true;
        await existing.save();
        assignments.push(existing);
      } else {
        // Create new
        const vendorProductPricing = await VendorProductPricing.create({
          vendor_id: data.vendor_id,
          product_id: product._id,
          purchasePercentage: data.purchasePercentage,
          purchasePrice,
          availableStock: data.availableStock || 0,
          isActive: true,
        });
        assignments.push(vendorProductPricing);
      }
    }

    return {
      assignedCount: assignments.length,
      assignments,
    };
  }

  // Get all assignments for a vendor (brands and products)
  static async getVendorAssignments(vendor_id: string) {
    // Validate vendor exists
    const vendor = await User.findById(vendor_id);
    if (!vendor || (vendor.role !== 'vendor' && vendor.role !== 'retail_vendor' && vendor.role !== 'special_vendor')) {
      throw new AppError('Vendor not found', 404);
    }

    // Get all vendor product pricing entries
    const vendorProducts = await VendorProductPricing.find({ vendor_id })
      .populate({
        path: 'product_id',
        populate: {
          path: 'brand_id',
          select: 'name _id',
        },
      })
      .sort({ createdAt: -1 });

    // Group by brand
    const brandMap = new Map();
    const unassignedProducts = [];

    for (const vp of vendorProducts) {
      const product = vp.product_id as any;
      if (!product || !product.brand_id) {
        unassignedProducts.push(vp);
        continue;
      }

      const brandId = product.brand_id._id.toString();
      if (!brandMap.has(brandId)) {
        brandMap.set(brandId, {
          brand: product.brand_id,
          products: [],
        });
      }
      brandMap.get(brandId).products.push({
        _id: vp._id,
        product: {
          _id: product._id,
          name: product.name,
        },
        purchasePercentage: vp.purchasePercentage,
        purchasePrice: vp.purchasePrice,
        availableStock: vp.availableStock,
        isActive: vp.isActive,
      });
    }

    // Get vendor details to see which brands are in brandsHandled
    const vendorDetails = await VendorDetails.findOne({ vendor_id }).populate('brandsHandled');

    return {
      brands: Array.from(brandMap.values()),
      unassignedProducts,
      vendorDetails: vendorDetails ? {
        brandsHandled: vendorDetails.brandsHandled,
      } : null,
    };
  }
}

