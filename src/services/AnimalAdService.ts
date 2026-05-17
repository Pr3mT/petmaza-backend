import AnimalAd, { IAnimalAd, AnimalCategory } from '../models/AnimalAd';
import { AppError } from '../middlewares/errorHandler';

const VALID_CATEGORIES: AnimalCategory[] = ['Dog', 'Cat', 'Bird', 'Fish', 'SmallAnimal'];

export class AnimalAdService {
  static async createAd(data: {
    mainCategory: AnimalCategory;
    image: string;
    mobileImage?: string;
    ctaLink: string;
    displayOrder?: number;
    isActive?: boolean;
  }) {
    if (!VALID_CATEGORIES.includes(data.mainCategory)) {
      throw new AppError('Invalid mainCategory', 400);
    }
    const ad = await AnimalAd.create(data);
    return ad;
  }

  // Public — active ads for one animal category, ordered for the carousel
  static async getActiveAdsByCategory(mainCategory: AnimalCategory) {
    if (!VALID_CATEGORIES.includes(mainCategory)) {
      throw new AppError('Invalid mainCategory', 400);
    }
    const ads = await AnimalAd.find({ mainCategory, isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();
    return ads;
  }

  // Admin — list all ads, optionally filtered by category, optionally including inactive
  static async getAllAds(opts: { mainCategory?: AnimalCategory; includeInactive?: boolean } = {}) {
    const query: any = {};
    if (opts.mainCategory) {
      if (!VALID_CATEGORIES.includes(opts.mainCategory)) {
        throw new AppError('Invalid mainCategory', 400);
      }
      query.mainCategory = opts.mainCategory;
    }
    if (!opts.includeInactive) {
      query.isActive = true;
    }
    const ads = await AnimalAd.find(query)
      .sort({ mainCategory: 1, displayOrder: 1, createdAt: -1 })
      .lean();
    return ads;
  }

  static async getAdById(id: string) {
    const ad = await AnimalAd.findById(id);
    if (!ad) throw new AppError('Ad not found', 404);
    return ad;
  }

  static async updateAd(id: string, data: Partial<IAnimalAd>) {
    if (data.mainCategory && !VALID_CATEGORIES.includes(data.mainCategory)) {
      throw new AppError('Invalid mainCategory', 400);
    }
    const ad = await AnimalAd.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
    if (!ad) throw new AppError('Ad not found', 404);
    return ad;
  }

  // Hard delete — admins can also use isActive=false to hide without removing
  static async deleteAd(id: string) {
    const ad = await AnimalAd.findByIdAndDelete(id);
    if (!ad) throw new AppError('Ad not found', 404);
    return ad;
  }

  static async reorderAds(orders: { id: string; displayOrder: number }[]) {
    const updates = orders.map(({ id, displayOrder }) =>
      AnimalAd.findByIdAndUpdate(id, { displayOrder }, { new: true })
    );
    return Promise.all(updates);
  }
}
