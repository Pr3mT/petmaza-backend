import Product from '../models/Product';

export class WeightCalculationService {
  /**
   * Calculate total weight of order items
   */
  static async computeTotalWeight(items: Array<{ product_id: string; quantity: number }>): Promise<number> {
    const productIds = items.map(item => item.product_id);
    const products = await Product.find({ _id: { $in: productIds } });

    let totalWeight = 0;
    for (const item of items) {
      const product = products.find(p => p._id.toString() === item.product_id.toString());
      if (product) {
        totalWeight += product.weightGrams * item.quantity;
      }
    }

    // Add packaging weight (default 200g)
    totalWeight += 200;

    return totalWeight;
  }

  /**
   * Calculate volumetric weight
   */
  static calculateVolumetricWeight(length: number, width: number, height: number): number {
    // Formula: (L × W × H) / 5000 (in cm, result in kg, convert to grams)
    return (length * width * height) / 5000 * 1000;
  }

  /**
   * Get chargeable weight (max of actual and volumetric)
   */
  static getChargeableWeight(actualWeight: number, volumetricWeight: number): number {
    return Math.max(actualWeight, volumetricWeight);
  }

  /**
   * Calculate total dimensions of order
   */
  static async calculateOrderDimensions(
    items: Array<{ product_id: string; quantity: number }>
  ): Promise<{ length: number; width: number; height: number }> {
    const productIds = items.map(item => item.product_id);
    const products = await Product.find({ _id: { $in: productIds } });

    let maxLength = 0;
    let maxWidth = 0;
    let totalHeight = 0;

    for (const item of items) {
      const product = products.find(p => p._id.toString() === item.product_id.toString());
      if (product) {
        maxLength = Math.max(maxLength, product.dimensionsCm.l);
        maxWidth = Math.max(maxWidth, product.dimensionsCm.w);
        totalHeight += product.dimensionsCm.h * item.quantity;
      }
    }

    return {
      length: maxLength,
      width: maxWidth,
      height: totalHeight,
    };
  }
}

