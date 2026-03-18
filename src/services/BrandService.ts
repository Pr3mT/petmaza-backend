import Brand from '../models/Brand';
import Category from '../models/Category';
import { AppError } from '../middlewares/errorHandler';
import mongoose from 'mongoose';

export class BrandService {
  // Create brand
  static async createBrand(data: {
    name: string;
    description?: string;
    image?: string;
    subcategories?: string[];
  }) {
    console.log('BrandService.createBrand - Input data:', JSON.stringify(data, null, 2));
    
    // Check if brand already exists
    const existingBrand = await Brand.findOne({ name: data.name });
    if (existingBrand) {
      throw new AppError('Brand with this name already exists', 400);
    }

    // Validate subcategories if provided (must be valid ObjectIds and exist in DB)
    if (data.subcategories && data.subcategories.length > 0) {
      console.log('Validating subcategory IDs:', data.subcategories);
      
      // Check if all are valid ObjectIds
      const invalidIds = data.subcategories.filter(id => !mongoose.Types.ObjectId.isValid(id));
      if (invalidIds.length > 0) {
        throw new AppError(`Invalid subcategory IDs: ${invalidIds.join(', ')}`, 400);
      }
      
      // Check if all categories exist in DB and are active (no parentCategoryId restriction)
      const categories = await Category.find({
        _id: { $in: data.subcategories },
        isActive: true
      });
      
      if (categories.length !== data.subcategories.length) {
        const foundIds = categories.map(c => c._id.toString());
        const notFound = data.subcategories.filter(id => !foundIds.includes(id));
        throw new AppError(`Categories not found or inactive: ${notFound.join(', ')}`, 400);
      }
      
      console.log(`All ${categories.length} categories validated successfully`);
    }

    const brand = await Brand.create(data);
    
    // Populate subcategories for the response
    await brand.populate('subcategories');
    
    console.log('Brand created in DB:', JSON.stringify(brand.toObject(), null, 2));
    
    return brand;
  }

  // Get all brands
  static async getAllBrands(includeInactive = false) {
    const query: any = {};
    if (!includeInactive) {
      query.isActive = true;
    }

    const brands = await Brand.find(query)
      .populate('subcategories', 'name description image')
      .sort({ name: 1 });
    
    console.log(`BrandService.getAllBrands - Found ${brands.length} brands`);
    if (brands.length > 0) {
      console.log('First brand subcategories:', brands[0].subcategories);
      console.log('First brand subcategories length:', brands[0].subcategories?.length);
    }
    
    return brands;
  }

  // Get brand by ID
  static async getBrandById(id: string) {
    const brand = await Brand.findById(id)
      .populate('subcategories', 'name description image');
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
    subcategories?: string[];
    isActive?: boolean;
  }) {
    console.log('BrandService.updateBrand - ID:', id);
    console.log('BrandService.updateBrand - Input data:', JSON.stringify(data, null, 2));
    
    // Check if name is being updated and already exists
    if (data.name) {
      const existingBrand = await Brand.findOne({ name: data.name, _id: { $ne: id } });
      if (existingBrand) {
        throw new AppError('Brand with this name already exists', 400);
      }
    }

    // Validate subcategories if provided (must be valid ObjectIds and exist in DB)
    if (data.subcategories !== undefined && data.subcategories.length > 0) {
      console.log('Validating subcategory IDs:', data.subcategories);
      
      // Check if all are valid ObjectIds
      const invalidIds = data.subcategories.filter(id => !mongoose.Types.ObjectId.isValid(id));
      if (invalidIds.length > 0) {
        throw new AppError(`Invalid subcategory IDs: ${invalidIds.join(', ')}`, 400);
      }
      
      // Check if all categories exist in DB and are active (no parentCategoryId restriction)
      const categories = await Category.find({
        _id: { $in: data.subcategories },
        isActive: true
      });
      
      if (categories.length !== data.subcategories.length) {
        const foundIds = categories.map(c => c._id.toString());
        const notFound = data.subcategories.filter(id => !foundIds.includes(id));
        throw new AppError(`Categories not found or inactive: ${notFound.join(', ')}`, 400);
      }
      
      console.log(`All ${categories.length} categories validated successfully`);
    }

    const brand = await Brand.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    }).populate('subcategories', 'name description image');

    if (!brand) {
      throw new AppError('Brand not found', 404);
    }

    console.log('Brand updated in DB:', JSON.stringify(brand.toObject(), null, 2));

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

  // Get brands by subcategory
  static async getBrandsBySubcategory(subcategory: string) {
    const brands = await Brand.find({
      subcategories: subcategory,
      isActive: true,
    }).sort({ name: 1 });

    return brands;
  }

  // Get brands by multiple subcategories
  static async getBrandsBySubcategories(subcategories: string[]) {
    const brands = await Brand.find({
      subcategories: { $in: subcategories },
      isActive: true,
    }).sort({ name: 1 });

    return brands;
  }

  // Add subcategories to a brand
  static async addSubcategoriesToBrand(id: string, subcategories: string[]) {
    // Validate subcategories
    const invalidSubcategories = subcategories.filter(
      (sub) => !isValidSubcategory(sub)
    );
    if (invalidSubcategories.length > 0) {
      throw new AppError(
        `Invalid subcategories: ${invalidSubcategories.join(', ')}`,
        400
      );
    }

    const brand = await Brand.findByIdAndUpdate(
      id,
      { $addToSet: { subcategories: { $each: subcategories } } },
      { new: true }
    );

    if (!brand) {
      throw new AppError('Brand not found', 404);
    }

    return brand;
  }

  // Remove subcategories from a brand
  static async removeSubcategoriesFromBrand(id: string, subcategories: string[]) {
    const brand = await Brand.findByIdAndUpdate(
      id,
      { $pull: { subcategories: { $in: subcategories } } },
      { new: true }
    );

    if (!brand) {
      throw new AppError('Brand not found', 404);
    }

    return brand;
  }
}

