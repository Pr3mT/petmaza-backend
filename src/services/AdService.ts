import Ad, { IAd } from '../models/Ad';
import { AppError } from '../middlewares/errorHandler';

export class AdService {
  // Create ad
  static async createAd(data: {
    title: string;
    description?: string;
    image: string;
    link?: string;
    position: 'top' | 'bottom' | 'popup' | 'sidebar';
    startDate?: Date;
    endDate?: Date;
    displayOrder?: number;
  }) {
    const ad = await Ad.create(data);
    return ad;
  }

  // Get active ads for public display (filtered by position and date)
  static async getActiveAds(position?: string) {
    const now = new Date();
    const query: any = { isActive: true };

    if (position) {
      query.position = position;
    }

    // Filter by date range if dates are set
    query.$or = [
      { startDate: { $exists: false }, endDate: { $exists: false } },
      { startDate: { $lte: now }, endDate: { $gte: now } },
      { startDate: { $lte: now }, endDate: { $exists: false } },
      { startDate: { $exists: false }, endDate: { $gte: now } },
    ];

    const ads = await Ad.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();
    return ads;
  }

  // Get all ads (admin - including inactive)
  static async getAllAds(includeInactive = false) {
    const query: any = {};
    if (!includeInactive) {
      query.isActive = true;
    }

    const ads = await Ad.find(query)
      .sort({ position: 1, displayOrder: 1, createdAt: -1 })
      .lean();
    return ads;
  }

  // Get ad by ID
  static async getAdById(id: string) {
    const ad = await Ad.findById(id);
    if (!ad) {
      throw new AppError('Ad not found', 404);
    }
    return ad;
  }

  // Update ad
  static async updateAd(id: string, data: Partial<IAd>) {
    const ad = await Ad.findByIdAndUpdate(
      id,
      data,
      { new: true, runValidators: true }
    );

    if (!ad) {
      throw new AppError('Ad not found', 404);
    }

    return ad;
  }

  // Delete ad (soft delete)
  static async deleteAd(id: string) {
    const ad = await Ad.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!ad) {
      throw new AppError('Ad not found', 404);
    }

    return ad;
  }

  // Hard delete ad (permanent)
  static async permanentDeleteAd(id: string) {
    const ad = await Ad.findByIdAndDelete(id);

    if (!ad) {
      throw new AppError('Ad not found', 404);
    }

    return ad;
  }

  // Increment impression count
  static async incrementImpression(id: string) {
    const ad = await Ad.findByIdAndUpdate(
      id,
      { $inc: { impressionCount: 1 } },
      { new: true }
    );
    return ad;
  }

  // Increment click count
  static async incrementClick(id: string) {
    const ad = await Ad.findByIdAndUpdate(
      id,
      { $inc: { clickCount: 1 } },
      { new: true }
    );
    return ad;
  }

  // Reorder ads
  static async reorderAds(adIds: string[]) {
    const updatePromises = adIds.map((id, index) =>
      Ad.findByIdAndUpdate(id, { displayOrder: index })
    );
    await Promise.all(updatePromises);
    return { success: true };
  }
}
