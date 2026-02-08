import User from '../models/User';
import Product from '../models/Product';

export class VendorMatchingService {
  /**
   * Find retail vendors serving a specific pincode
   */
  static async findRetailVendorsForPincode(pincode: string): Promise<any[]> {
    const vendors = await User.find({
      role: 'retail_vendor',
      isApproved: true,
      pincodesServed: pincode,
    }).select('name email phone pincodesServed');

    return vendors;
  }

  /**
   * Check if there are vendors for a pincode
   */
  static async hasVendorsForPincode(pincode: string): Promise<boolean> {
    const count = await User.countDocuments({
      role: 'retail_vendor',
      isApproved: true,
      pincodesServed: pincode,
    });
    return count > 0;
  }

  /**
   * Check if vendor serves a pincode
   */
  static async vendorServesPincode(vendorId: string, pincode: string): Promise<boolean> {
    const vendor = await User.findById(vendorId);
    if (!vendor || vendor.role !== 'retail_vendor') {
      return false;
    }
    return vendor.pincodesServed?.includes(pincode) || false;
  }

  /**
   * Find special vendor for a product
   */
  static async findSpecialVendorForProduct(productId: string): Promise<any | null> {
    const product = await Product.findById(productId);
    if (!product || !product.specialVendorId) {
      return null;
    }

    const vendor = await User.findById(product.specialVendorId);
    if (!vendor || vendor.role !== 'special_vendor' || !vendor.isApproved) {
      return null;
    }

    return vendor;
  }

  /**
   * Get special vendor from order items (all items should have same special vendor)
   */
  static async getSpecialVendorFromItems(items: Array<{ product_id: string }>): Promise<any | null> {
    if (items.length === 0) return null;

    const productIds = items.map(item => item.product_id);
    const products = await Product.find({ _id: { $in: productIds } });

    if (products.length === 0) return null;

    // All products should have the same specialVendorId
    const specialVendorIds = products
      .map(p => p.specialVendorId?.toString())
      .filter(Boolean);

    if (specialVendorIds.length === 0) return null;

    const uniqueVendorIds = [...new Set(specialVendorIds)];
    if (uniqueVendorIds.length > 1) {
      throw new Error('All products in order must have the same special vendor');
    }

    const vendor = await User.findById(uniqueVendorIds[0]);
    if (!vendor || vendor.role !== 'special_vendor' || !vendor.isApproved) {
      return null;
    }

    return vendor;
  }
}

