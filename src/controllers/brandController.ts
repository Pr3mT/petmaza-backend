import { Request, Response, NextFunction } from 'express';
import { BrandService } from '../services/BrandService';
import { AppError } from '../middlewares/errorHandler';
import { SUBCATEGORIES_BY_MAIN_CATEGORY, ALL_SUBCATEGORIES } from '../constants/subcategories';
import { clearCache } from '../middlewares/cache';

export const createBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Create brand request - Data:', JSON.stringify(req.body, null, 2));
    
    const brand = await BrandService.createBrand(req.body);
    
    console.log('Brand created successfully:', {
      id: brand._id,
      name: brand.name,
      subcategories: brand.subcategories,
      subcategoriesCount: brand.subcategories?.length || 0
    });
    
    // Clear brand cache so customers see the new brand
    clearCache('/api/brands');
    
    res.status(201).json({
      success: true,
      message: 'Brand created successfully',
      data: { brand },
    });
  } catch (error: any) {
    console.error('Error creating brand:', error.message);
    next(error);
  }
};

export const getAllBrands = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const subcategory = req.query.subcategory as string;

    let brands;
    if (subcategory) {
      brands = await BrandService.getBrandsBySubcategory(subcategory);
    } else {
      brands = await BrandService.getAllBrands(includeInactive);
    }

    res.status(200).json({
      success: true,
      data: { brands },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getBrandById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brand = await BrandService.getBrandById(req.params.id);
    res.status(200).json({
      success: true,
      data: { brand },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Update brand request - ID:', req.params.id);
    console.log('Update brand data:', JSON.stringify(req.body, null, 2));
    
    const brand = await BrandService.updateBrand(req.params.id, req.body);
    
    console.log('Brand updated successfully:', brand._id);
    
    // Clear brand cache so customers see the updated brand
    clearCache('/api/brands');
    
    res.status(200).json({
      success: true,
      message: 'Brand updated successfully',
      data: { brand },
    });
  } catch (error: any) {
    console.error('Error updating brand:', error.message);
    next(error);
  }
};

export const deleteBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brand = await BrandService.deleteBrand(req.params.id);
    
    // Clear brand cache so customers don't see the deleted brand
    clearCache('/api/brands');
    
    res.status(200).json({
      success: true,
      message: 'Brand deleted successfully',
      data: { brand },
    });
  } catch (error: any) {
    next(error);
  }
};

// Get all available subcategories
export const getSubcategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mainCategory = req.query.mainCategory as string;

    let subcategories;
    if (mainCategory && SUBCATEGORIES_BY_MAIN_CATEGORY[mainCategory as keyof typeof SUBCATEGORIES_BY_MAIN_CATEGORY]) {
      subcategories = SUBCATEGORIES_BY_MAIN_CATEGORY[mainCategory as keyof typeof SUBCATEGORIES_BY_MAIN_CATEGORY];
    } else {
      subcategories = SUBCATEGORIES_BY_MAIN_CATEGORY;
    }

    res.status(200).json({
      success: true,
      data: { subcategories },
    });
  } catch (error: any) {
    next(error);
  }
};

// Add subcategories to a brand
export const addSubcategoriesToBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subcategories } = req.body;

    if (!subcategories || !Array.isArray(subcategories)) {
      throw new AppError('Subcategories must be an array', 400);
    }

    const brand = await BrandService.addSubcategoriesToBrand(req.params.id, subcategories);
    res.status(200).json({
      success: true,
      message: 'Subcategories added successfully',
      data: { brand },
    });
  } catch (error: any) {
    next(error);
  }
};

// Remove subcategories from a brand
export const removeSubcategoriesFromBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subcategories } = req.body;

    if (!subcategories || !Array.isArray(subcategories)) {
      throw new AppError('Subcategories must be an array', 400);
    }

    const brand = await BrandService.removeSubcategoriesFromBrand(req.params.id, subcategories);
    res.status(200).json({
      success: true,
      message: 'Subcategories removed successfully',
      data: { brand },
    });
  } catch (error: any) {
    next(error);
  }
};

