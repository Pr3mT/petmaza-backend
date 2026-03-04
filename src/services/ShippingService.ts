import ShippingSettings from '../models/ShippingSettings';

export class ShippingService {
  /**
   * Get current shipping settings (with caching)
   */
  private static settingsCache: any = null;
  private static cacheExpiry: number = 0;
  private static CACHE_TTL = 60000; // 1 minute cache

  static async getSettings() {
    const now = Date.now();
    
    // Use cache if valid
    if (this.settingsCache && now < this.cacheExpiry) {
      return this.settingsCache;
    }

    // Fetch from database
    let settings = await ShippingSettings.findOne();
    
    // Create default settings if none exist
    if (!settings) {
      settings = await ShippingSettings.create({
        shippingEnabled: true,
        freeShippingThreshold: 300,
        shippingChargesBelowThreshold: 50,
        platformFeeEnabled: true,
        platformFeeThreshold: 0,
        platformFeeAmount: 10,
      });
    }

    // Update cache
    this.settingsCache = settings;
    this.cacheExpiry = now + this.CACHE_TTL;
    
    return settings;
  }

  /**
   * Clear settings cache (call after updating settings)
   */
  static clearCache() {
    this.settingsCache = null;
    this.cacheExpiry = 0;
  }

  /**
   * Calculate shipping charges and platform fee
   * @param subtotal - Order subtotal (before charges)
   * @returns Object containing shippingCharges, platformFee, and total
   */
  static async calculateCharges(subtotal: number): Promise<{
    shippingCharges: number;
    platformFee: number;
    total: number;
  }> {
    const settings = await this.getSettings();
    
    let shippingCharges = 0;
    let platformFee = 0;

    // Calculate shipping charges
    if (settings.shippingEnabled) {
      if (subtotal < settings.freeShippingThreshold) {
        shippingCharges = settings.shippingChargesBelowThreshold;
      }
      // If subtotal >= threshold, shipping is free (0)
    }

    // Calculate platform fee
    if (settings.platformFeeEnabled) {
      if (subtotal >= settings.platformFeeThreshold) {
        platformFee = settings.platformFeeAmount;
      }
      // If subtotal < threshold, no platform fee
    }

    const total = subtotal + shippingCharges + platformFee;

    return {
      shippingCharges,
      platformFee,
      total,
    };
  }

  /**
   * Get shipping info for display on frontend
   */
  static async getShippingInfo() {
    const settings = await this.getSettings();
    
    return {
      shippingEnabled: settings.shippingEnabled,
      freeShippingThreshold: settings.freeShippingThreshold,
      shippingCharges: settings.shippingChargesBelowThreshold,
      platformFeeEnabled: settings.platformFeeEnabled,
      platformFeeThreshold: settings.platformFeeThreshold,
      platformFee: settings.platformFeeAmount,
    };
  }
}
