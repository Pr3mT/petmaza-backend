import Product from '../models/Product';
import { IProduct } from '../types';

export class PricingService {
  /**
   * Calculate vendor price from MRP and margin
   */
  static calculateVendorPrice(mrp: number, marginPercent: number): number {
    return mrp * (1 - marginPercent / 100);
  }

  /**
   * Calculate margin amount
   */
  static calculateMarginAmount(salePrice: number, vendorPrice: number): number {
    return salePrice - vendorPrice;
  }

  /**
   * Calculate margin percentage
   */
  static calculateMarginPercentage(salePrice: number, vendorPrice: number): number {
    if (vendorPrice === 0) return 0;
    return ((salePrice - vendorPrice) / vendorPrice) * 100;
  }

  /**
   * Get product with calculated prices
   */
  static async getProductWithPrices(productId: string): Promise<IProduct | null> {
    const product = await Product.findById(productId);
    if (!product) return null;

    // Ensure vendor_price is calculated
    if (!product.vendor_price || product.isModified('mrp') || product.isModified('vendorMargin')) {
      product.vendor_price = this.calculateVendorPrice(product.mrp, product.vendorMargin);
      await product.save();
    }

    return product;
  }

  /**
   * Snapshot prices for order items
   */
  static snapshotPrices(product: IProduct, quantity: number) {
    const unitPriceAtOrder = product.sale_price;
    const vendorPriceAtOrder = product.vendor_price;
    const subtotal = unitPriceAtOrder * quantity;
    const vendor_subtotal = vendorPriceAtOrder * quantity;
    const margin_amount = this.calculateMarginAmount(unitPriceAtOrder, vendorPriceAtOrder);
    const margin_total = margin_amount * quantity;
    const margin_percentage = this.calculateMarginPercentage(unitPriceAtOrder, vendorPriceAtOrder);

    return {
      unitPriceAtOrder,
      vendorPriceAtOrder,
      subtotal,
      vendor_subtotal,
      margin_amount,
      margin_total,
      margin_percentage,
    };
  }
}

