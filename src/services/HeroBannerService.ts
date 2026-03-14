import HeroBanner, { IHeroBanner } from '../models/HeroBanner';
import { AppError } from '../middlewares/errorHandler';

export class HeroBannerService {
  // Create hero banner
  static async createBanner(data: {
    bannerType?: 'text' | 'image';
    title: string;
    subtitle: string;
    description?: string;
    couponCode?: string;
    ctaText: string;
    ctaLink: string;
    bgColor: string;
    accentColor: string;
    image: string;
    mobileImage?: string;
    displayOrder?: number;
    isActive?: boolean;
  }) {
    const banner = await HeroBanner.create(data);
    return banner;
  }

  // Get all banners (public - only active)
  static async getActiveBanners() {
    const banners = await HeroBanner.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();
    return banners;
  }

  // Get all banners (admin - including inactive)
  static async getAllBanners(includeInactive = false) {
    const query: any = {};
    if (!includeInactive) {
      query.isActive = true;
    }

    const banners = await HeroBanner.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();
    return banners;
  }

  // Get banner by ID
  static async getBannerById(id: string) {
    const banner = await HeroBanner.findById(id);
    if (!banner) {
      throw new AppError('Banner not found', 404);
    }
    return banner;
  }

  // Update banner
  static async updateBanner(id: string, data: Partial<IHeroBanner>) {
    const banner = await HeroBanner.findByIdAndUpdate(
      id,
      data,
      { new: true, runValidators: true }
    );

    if (!banner) {
      throw new AppError('Banner not found', 404);
    }

    return banner;
  }

  // Delete banner (soft delete)
  static async deleteBanner(id: string) {
    const banner = await HeroBanner.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!banner) {
      throw new AppError('Banner not found', 404);
    }

    return banner;
  }

  // Reorder banners
  static async reorderBanners(bannerOrders: { id: string; displayOrder: number }[]) {
    const updatePromises = bannerOrders.map(({ id, displayOrder }) =>
      HeroBanner.findByIdAndUpdate(id, { displayOrder }, { new: true })
    );

    const updatedBanners = await Promise.all(updatePromises);
    return updatedBanners;
  }
}
