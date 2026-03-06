import { Request, Response, NextFunction } from 'express';
import { AdService } from '../services/AdService';
import { AuthRequest } from '../middlewares/auth';

// Public - Get active ads for display
export const getActiveAds = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { position } = req.query;
    const ads = await AdService.getActiveAds(position as string);
    res.status(200).json({
      success: true,
      data: { ads },
    });
  } catch (error: any) {
    next(error);
  }
};

// Admin - Get all ads
export const getAllAds = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const ads = await AdService.getAllAds(includeInactive);
    res.status(200).json({
      success: true,
      data: { ads },
    });
  } catch (error: any) {
    next(error);
  }
};

// Admin - Get ad by ID
export const getAdById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ad = await AdService.getAdById(req.params.id);
    res.status(200).json({
      success: true,
      data: { ad },
    });
  } catch (error: any) {
    next(error);
  }
};

// Admin - Create ad
export const createAd = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ad = await AdService.createAd(req.body);
    res.status(201).json({
      success: true,
      message: 'Ad created successfully',
      data: { ad },
    });
  } catch (error: any) {
    next(error);
  }
};

// Admin - Update ad
export const updateAd = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ad = await AdService.updateAd(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Ad updated successfully',
      data: { ad },
    });
  } catch (error: any) {
    next(error);
  }
};

// Admin - Delete ad (soft delete)
export const deleteAd = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ad = await AdService.deleteAd(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Ad deleted successfully',
      data: { ad },
    });
  } catch (error: any) {
    next(error);
  }
};

// Admin - Permanent delete ad
export const permanentDeleteAd = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ad = await AdService.permanentDeleteAd(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Ad permanently deleted',
      data: { ad },
    });
  } catch (error: any) {
    next(error);
  }
};

// Admin - Reorder ads
export const reorderAds = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { adIds } = req.body;
    await AdService.reorderAds(adIds);
    res.status(200).json({
      success: true,
      message: 'Ads reordered successfully',
    });
  } catch (error: any) {
    next(error);
  }
};

// Public - Track impression
export const trackImpression = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await AdService.incrementImpression(req.params.id);
    res.status(200).json({
      success: true,
    });
  } catch (error: any) {
    next(error);
  }
};

// Public - Track click
export const trackClick = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await AdService.incrementClick(req.params.id);
    res.status(200).json({
      success: true,
    });
  } catch (error: any) {
    next(error);
  }
};
