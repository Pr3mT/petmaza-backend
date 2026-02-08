import Brand from '../models/Brand';
import { AppError } from '../middlewares/errorHandler';

export class BrandService {
  // Create brand
  static async createBrand(data: {
    name: string;
    description?: string;
    image?: string;
  }) {
    // Check if brand already exists
    const existingBrand = await Brand.findOne({ name: data.name });
    if (existingBrand) {
      throw new AppError('Brand with this name already exists', 400);
    }

    const brand = await Brand.create(data);
    return brand;
  }

  // Get all brands
  static async getAllBrands(includeInactive = false) {
    const query: any = {};
    if (!includeInactive) {
      query.isActive = true;
    }

    const brands = await Brand.find(query).sort({ name: 1 });
    return brands;
  }

  // Get brand by ID
  static async getBrandById(id: string) {
    const brand = await Brand.findById(id);
    if (!brand) {
      throw new AppError('Brand not found', 404);
    }
    return brand;
  }

  // Update brand
  static async updateBrand(id: string, data: {
    name?: string;
    description?: string;
    image?: string;
    isActive?: boolean;
  }) {
    // Check if name is being updated and already exists
    if (data.name) {
      const existingBrand = await Brand.findOne({ name: data.name, _id: { $ne: id } });
      if (existingBrand) {
        throw new AppError('Brand with this name already exists', 400);
      }
    }

    const brand = await Brand.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    if (!brand) {
      throw new AppError('Brand not found', 404);
    }

    return brand;
  }

  // Delete brand (soft delete)
  static async deleteBrand(id: string) {
    const brand = await Brand.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!brand) {
      throw new AppError('Brand not found', 404);
    }

    return brand;
  }
}

