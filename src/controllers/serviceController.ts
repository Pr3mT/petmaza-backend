import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import ServiceRequest from '../models/ServiceRequest';
import SiteSettings from '../models/SiteSettings';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import cloudinary from '../config/cloudinary';

const BIRD_DNA_PRICE_PER_BIRD = 300;

const getStoredReportPublicId = (report: { publicId?: string; url?: string }) => {
  if (report.publicId) {
    return report.publicId;
  }

  if (!report.url) {
    return null;
  }

  const marker = '/raw/upload/';
  const markerIndex = report.url.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const pathAfterUpload = report.url.slice(markerIndex + marker.length);
  const versionlessPath = pathAfterUpload.replace(/^v\d+\//, '');
  return decodeURIComponent(versionlessPath.split('?')[0]);
};

const canAccessServiceRequest = (serviceRequest: any, user: AuthRequest['user']) => {
  const isOwner = serviceRequest.customerId?.toString() === user?._id?.toString();
  const isAdmin = user?.role === 'admin';
  const isMyShopVendor = user?.role === 'vendor' && user?.vendorType === 'MY_SHOP';

  return isOwner || isAdmin || isMyShopVendor;
};

const parsePosition = (value: string, label: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError(`Invalid ${label}`, 400);
  }
  return parsed;
};

const normalizeBirdReports = (serviceRequest: any) => {
  const normalized = typeof serviceRequest.toObject === 'function' ? serviceRequest.toObject() : serviceRequest;

  if (!Array.isArray(normalized.birds)) {
    normalized.birds = [];
    return normalized;
  }

  const hasBirdLevelReports = normalized.birds.some((bird: any) => Array.isArray(bird?.labReports) && bird.labReports.length > 0);
  if (
    !hasBirdLevelReports
    && normalized.birds.length > 0
    && Array.isArray(normalized.labReports)
    && normalized.labReports.length > 0
  ) {
    normalized.birds[0].labReports = normalized.labReports;
  }

  return normalized;
};

const getBirdReport = (serviceRequest: any, birdIndex: number, reportIndex: number) => {
  const bird = serviceRequest.birds?.[birdIndex];
  if (!bird) {
    throw new AppError('Bird not found in this request', 404);
  }

  const birdReports = Array.isArray(bird.labReports) ? bird.labReports : [];

  if (reportIndex < birdReports.length) {
    return birdReports[reportIndex];
  }

  // Backward compatibility for older request-level reports.
  if (birdIndex === 0 && Array.isArray(serviceRequest.labReports) && reportIndex < serviceRequest.labReports.length) {
    return serviceRequest.labReports[reportIndex];
  }

  throw new AppError('Lab report not found', 404);
};

// ─── Customer: Create request ────────────────────────────────────────────────

export const createBirdDNAService = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Check if service is enabled
    const settings = await SiteSettings.findOne();
    if (settings && !settings.birdDnaServiceEnabled) {
      return next(new AppError('Bird DNA Testing service is currently unavailable', 503));
    }

    const {
      customerName,
      farm,
      address,
      birds,
      pickupAddress,
      extraNote,
      payment_id,
    } = req.body;

    if (!birds || birds.length === 0) {
      return next(new AppError('At least one bird is required', 400));
    }

    const pricePerSample = settings?.birdDnaPricePerSample ?? BIRD_DNA_PRICE_PER_BIRD;
    const totalAmount = birds.length * pricePerSample;

    const deliveryAddress = {
      street: 'Partner Lab',
      city: 'Lab City',
      state: 'Lab State',
      pincode: '000000',
    };

    const serviceRequest = await ServiceRequest.create({
      customerId: req.user._id,
      serviceType: 'bird_dna',
      customerName,
      farm,
      address: address || pickupAddress,
      birds,
      pickupAddress,
      deliveryAddress,
      extraNote,
      payment_id: payment_id || undefined,
      payment_status: payment_id ? 'Paid' : 'Pending',
      pricePerSample,
      totalAmount,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Bird DNA service request created successfully',
      data: { serviceRequest },
    });
  } catch (error: any) {
    next(error);
  }
};

// ─── Customer: list own requests ─────────────────────────────────────────────

export const getMyServiceRequests = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const serviceRequests = await ServiceRequest.find({ customerId: req.user._id })
      .sort({ createdAt: -1 });

    const normalizedServiceRequests = serviceRequests.map((request) => normalizeBirdReports(request));

    res.status(200).json({
      success: true,
      data: { serviceRequests: normalizedServiceRequests },
    });
  } catch (error: any) {
    next(error);
  }
};

// ─── Customer/Admin: get one request ─────────────────────────────────────────

export const getServiceRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const serviceRequest = await ServiceRequest.findById(id)
      .populate('customerId', 'name email phone')
      .populate('vendorAssignedId', 'name email');

    if (!serviceRequest) {
      return next(new AppError('Service request not found', 404));
    }

    if (!canAccessServiceRequest(serviceRequest, req.user)) {
      return next(new AppError('Access denied', 403));
    }

    res.status(200).json({
      success: true,
      data: { serviceRequest: normalizeBirdReports(serviceRequest) },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getLabReportDownloadUrl = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, birdIndex, reportIndex } = req.params;

    const serviceRequest = await ServiceRequest.findById(id);
    if (!serviceRequest) {
      return next(new AppError('Service request not found', 404));
    }

    if (!canAccessServiceRequest(serviceRequest, req.user)) {
      return next(new AppError('Access denied', 403));
    }

    const birdPosition = parsePosition(birdIndex, 'bird index');
    const reportPosition = parsePosition(reportIndex, 'report index');
    const report = getBirdReport(serviceRequest, birdPosition, reportPosition);

    const publicId = getStoredReportPublicId(report);
    if (!publicId) {
      return next(new AppError('Lab report file reference is missing', 400));
    }

    const signedUrl = cloudinary.utils.private_download_url(publicId, null, {
      resource_type: 'raw',
      type: 'upload',
      attachment: true,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    });

    res.status(200).json({
      success: true,
      data: {
        downloadUrl: signedUrl,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

// ─── Admin / MY_SHOP Vendor: list all requests ───────────────────────────────

export const getAllServiceRequests = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // MY_SHOP vendors can see all requests (they handle fulfillment);
    // other vendor types are not allowed
    if (req.user.role === 'vendor' && req.user.vendorType !== 'MY_SHOP') {
      return next(new AppError('Access denied', 403));
    }

    const { status, page = 1, limit = 20 } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (req.user.role === 'vendor') {
      // MY_SHOP vendor sees requests assigned to them OR unassigned
      filter.$or = [
        { vendorAssignedId: req.user._id },
        { vendorAssignedId: { $exists: false } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [serviceRequests, total] = await Promise.all([
      ServiceRequest.find(filter)
        .populate('customerId', 'name email phone')
        .populate('vendorAssignedId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ServiceRequest.countDocuments(filter),
    ]);

    const normalizedServiceRequests = serviceRequests.map((request) => normalizeBirdReports(request));

    res.status(200).json({
      success: true,
      data: {
        serviceRequests: normalizedServiceRequests,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    next(error);
  }
};

// ─── Admin / MY_SHOP Vendor: update status ───────────────────────────────────

export const updateServiceStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user.role === 'vendor' && req.user.vendorType !== 'MY_SHOP') {
      return next(new AppError('Access denied', 403));
    }

    const { id } = req.params;
    const { status, vendorAssignedId } = req.body;

    const allowed = ['pending', 'accepted', 'sample_collected', 'testing', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      return next(new AppError(`Invalid status. Allowed: ${allowed.join(', ')}`, 400));
    }

    const serviceRequest = await ServiceRequest.findById(id);
    if (!serviceRequest) {
      return next(new AppError('Service request not found', 404));
    }

    serviceRequest.status = status;
    if (vendorAssignedId) serviceRequest.vendorAssignedId = vendorAssignedId;
    await serviceRequest.save();

    res.status(200).json({
      success: true,
      message: 'Status updated',
      data: { serviceRequest },
    });
  } catch (error: any) {
    next(error);
  }
};

// ─── Admin / MY_SHOP Vendor: upload lab report ───────────────────────────────

export const uploadLabReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user.role === 'vendor' && req.user.vendorType !== 'MY_SHOP') {
      return next(new AppError('Access denied', 403));
    }

    const { id, birdIndex } = req.params;
    const { url, publicId, note } = req.body;

    if (!url) {
      return next(new AppError('Report URL is required', 400));
    }

    const birdPosition = parsePosition(birdIndex, 'bird index');
    const serviceRequest = await ServiceRequest.findById(id);
    if (!serviceRequest) {
      return next(new AppError('Service request not found', 404));
    }

    const bird = serviceRequest.birds?.[birdPosition];
    if (!bird) {
      return next(new AppError('Bird not found in this request', 404));
    }

    if (!Array.isArray(bird.labReports)) {
      bird.labReports = [];
    }

    bird.labReports.push({
      url,
      publicId,
      note,
      uploadedAt: new Date(),
      uploadedBy: req.user._id.toString(),
    });

    // Required: Mongoose does not detect deep mutations in mixed/subdocument arrays without this.
    serviceRequest.markModified('birds');

    const allBirdsHaveAtLeastOneReport = (serviceRequest.birds || []).every(
      (birdItem: any) => Array.isArray(birdItem.labReports) && birdItem.labReports.length > 0
    );

    if (allBirdsHaveAtLeastOneReport) {
      serviceRequest.status = 'completed';
    }

    await serviceRequest.save();

    res.status(200).json({
      success: true,
      message: 'Lab report uploaded successfully',
      data: { serviceRequest: normalizeBirdReports(serviceRequest) },
    });
  } catch (error: any) {
    next(error);
  }
};

// ─── Admin: get / update site settings ───────────────────────────────────────

export const getSiteSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let settings = await SiteSettings.findOne();
    if (!settings) settings = await SiteSettings.create({});
    res.status(200).json({ success: true, data: settings });
  } catch (error: any) {
    next(error);
  }
};

export const updateSiteSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { birdDnaServiceEnabled, birdDnaPricePerSample } = req.body;

    let settings = await SiteSettings.findOne();
    if (!settings) settings = await SiteSettings.create({});

    if (typeof birdDnaServiceEnabled === 'boolean') {
      settings.birdDnaServiceEnabled = birdDnaServiceEnabled;
    }
    if (typeof birdDnaPricePerSample === 'number' && birdDnaPricePerSample > 0) {
      settings.birdDnaPricePerSample = birdDnaPricePerSample;
    }

    await settings.save();
    res.status(200).json({ success: true, data: settings });
  } catch (error: any) {
    next(error);
  }
};

// ─── Public: verify converted report via QR link ────────────────────────────

export const verifyLabReportQr = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestId = typeof req.query.requestId === 'string' ? req.query.requestId.trim() : '';
    const birdIndexRaw = req.query.birdIndex;
    const certId = typeof req.query.certId === 'string' ? req.query.certId.trim() : '';
    const wantsHtml = req.headers.accept?.includes('text/html');

    if (!requestId || birdIndexRaw === undefined) {
      const payload = {
        success: true,
        verified: false,
        message: 'Missing requestId or birdIndex',
      };
      if (wantsHtml) {
        return res.status(200).send(`<html><body style="font-family:Arial,sans-serif;padding:24px;"><h2>Petmaza Verification</h2><p style="color:#b91c1c;">Not Verified</p><p>${payload.message}</p></body></html>`);
      }
      return res.status(200).json(payload);
    }

    const birdIndex = Number(birdIndexRaw);
    if (!Number.isInteger(birdIndex) || birdIndex < 0) {
      const payload = {
        success: true,
        verified: false,
        message: 'Invalid birdIndex',
      };
      if (wantsHtml) {
        return res.status(200).send(`<html><body style="font-family:Arial,sans-serif;padding:24px;"><h2>Petmaza Verification</h2><p style="color:#b91c1c;">Not Verified</p><p>${payload.message}</p></body></html>`);
      }
      return res.status(200).json(payload);
    }

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      const payload = {
        success: true,
        verified: false,
        message: 'Invalid requestId format',
      };
      if (wantsHtml) {
        return res.status(200).send(`<html><body style="font-family:Arial,sans-serif;padding:24px;"><h2>Petmaza Verification</h2><p style="color:#b91c1c;">Not Verified</p><p>${payload.message}</p></body></html>`);
      }
      return res.status(200).json(payload);
    }

    const serviceRequest: any = await ServiceRequest.findById(requestId).select('customerName farm birds createdAt');
    if (!serviceRequest) {
      const payload = {
        success: true,
        verified: false,
        message: 'Request not found',
      };
      if (wantsHtml) {
        return res.status(200).send(`<html><body style="font-family:Arial,sans-serif;padding:24px;"><h2>Petmaza Verification</h2><p style="color:#b91c1c;">Not Verified</p><p>${payload.message}</p></body></html>`);
      }
      return res.status(200).json(payload);
    }

    const bird = serviceRequest.birds?.[birdIndex];
    if (!bird) {
      const payload = {
        success: true,
        verified: false,
        message: 'Bird not found in request',
      };
      if (wantsHtml) {
        return res.status(200).send(`<html><body style="font-family:Arial,sans-serif;padding:24px;"><h2>Petmaza Verification</h2><p style="color:#b91c1c;">Not Verified</p><p>${payload.message}</p></body></html>`);
      }
      return res.status(200).json(payload);
    }

    const reports = Array.isArray(bird.labReports) ? bird.labReports : [];
    const hasAnyReport = reports.length > 0;
    const certMatched = !certId || reports.some((report: any) => {
      const note = typeof report?.note === 'string' ? report.note.toLowerCase() : '';
      return note.includes(certId.toLowerCase());
    });

    const verified = hasAnyReport && certMatched;

    const payload = {
      success: true,
      verified,
      message: verified ? 'Petmaza Verified' : 'Not verified in Petmaza records',
      data: {
        requestId,
        birdIndex,
        farm: serviceRequest.farm,
        customerName: serviceRequest.customerName,
        birdName: bird.birdName,
        bandId: bird.bandId,
        species: bird.species,
      },
    };

    if (wantsHtml) {
      return res.status(200).send(`
        <html>
          <body style="font-family:Arial,sans-serif;padding:24px;background:#f8fafc;color:#111827;">
            <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">
              <h2 style="margin:0 0 8px 0;">Petmaza Report Verification</h2>
              <p style="font-size:20px;font-weight:700;color:${verified ? '#15803d' : '#b91c1c'};margin:8px 0;">${payload.message}</p>
              <p><strong>Request:</strong> ${requestId}</p>
              <p><strong>Bird:</strong> ${payload.data.birdName || `Bird ${birdIndex + 1}`}</p>
              <p><strong>Band Id:</strong> ${payload.data.bandId || 'N/A'}</p>
              <p><strong>Species:</strong> ${payload.data.species || 'N/A'}</p>
              <p><strong>Farm:</strong> ${payload.data.farm || 'N/A'}</p>
            </div>
          </body>
        </html>
      `);
    }

    return res.status(200).json(payload);
  } catch (error: any) {
    next(error);
  }
};

// ─── Public: get service enabled status ──────────────────────────────────────

export const getServiceAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let settings = await SiteSettings.findOne();
    if (!settings) settings = await SiteSettings.create({});
    res.status(200).json({
      success: true,
      data: {
        birdDnaServiceEnabled: settings.birdDnaServiceEnabled,
        pricePerSample: settings.birdDnaPricePerSample,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

