import { Request, Response, NextFunction } from 'express';
import { HeroBannerService } from '../services/HeroBannerService';
import { AuthRequest } from '../middlewares/auth';

// Public - Get active banners for homepage
export const getActiveBanners = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const banners = await HeroBannerService.getActiveBanners();
    res.status(200).json({
      success: true,
      data: { banners },
    });
  } catch (error: any) {
    next(error);
  }
};

// Admin - Get all banners
export const getAllBanners = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const banners = await HeroBannerService.getAllBanners(includeInactive);
    res.status(200).json({
      success: true,
      data: { banners },
    });
  } catch (error: any) {
    next(error);
  }
};

// Admin - Get banner by ID
export const getBannerById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const banner = await HeroBannerService.getBannerById(req.params.id);
    res.status(200).json({
      success: true,
      data: { banner },
    });
  } catch (error: any) {
    next(error);
  }
};

// Admin - Create banner
export const createBanner = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const banner = await HeroBannerService.createBanner(req.body);
    res.status(201).json({
      success: true,
      message: 'Hero banner created successfully',
      data: { banner },
    });
  } catch (error: any) {
    next(error);
  }
};

// Admin - Update banner
export const updateBanner = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const banner = await HeroBannerService.updateBanner(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Hero banner updated successfully',
      data: { banner },
    });
  } catch (error: any) {
    next(error);
  }
};

// Admin - Delete banner (soft delete)
export const deleteBanner = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const banner = await HeroBannerService.deleteBanner(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Hero banner deleted successfully',
      data: { banner },
    });
  } catch (error: any) {
    next(error);
  }
};

// Admin - Reorder banners
export const reorderBanners = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { bannerOrders } = req.body; // [{ id, displayOrder }]
    const banners = await HeroBannerService.reorderBanners(bannerOrders);
    res.status(200).json({
      success: true,
      message: 'Banners reordered successfully',
      data: { banners },
    });
  } catch (error: any) {
    next(error);
  }
};
