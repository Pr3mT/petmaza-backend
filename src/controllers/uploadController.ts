import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import cloudinary from '../config/cloudinary';
import streamifier from 'streamifier';
import ServiceRequest from '../models/ServiceRequest';
import { convertPartnerLabPdfToPetmazaPdf, extractLabReportWithText } from '../utils/labReportConverter';

const uploadRawPdfBuffer = (fileBuffer: Buffer, folder: string) => new Promise<any>((resolve, reject) => {
  const uploadStream = cloudinary.uploader.upload_stream(
    {
      folder,
      resource_type: 'raw',
      format: 'pdf',
    },
    (error, result) => {
      if (error) reject(error);
      else resolve(result);
    }
  );
  streamifier.createReadStream(fileBuffer).pipe(uploadStream);
});

const fetchRawPdfBufferFromCloudinary = async (publicId: string): Promise<Buffer> => {
  const downloadUrl = cloudinary.utils.private_download_url(publicId, null, {
    resource_type: 'raw',
    type: 'upload',
    expires_at: Math.floor(Date.now() / 1000) + 60 * 15,
  });

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error('Failed to fetch source PDF from Cloudinary');
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

/**
 * Upload single image to Cloudinary
 */
export const uploadImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    // Upload to Cloudinary using stream
    // Note: Image is already compressed by imageCompression middleware
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'petmaza/products',
          resource_type: 'image',
          // Removed transformations as images are already compressed
          // This prevents double compression and maintains quality
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      streamifier.createReadStream(req.file!.buffer).pipe(uploadStream);
    });

    const result: any = await uploadPromise;

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: result.secure_url,
        publicId: result.public_id,
      },
    });
  } catch (error: any) {
    next(new AppError(error.message || 'Error uploading image', 500));
  }
};

/**
 * Upload multiple images to Cloudinary
 */
export const uploadMultipleImages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return next(new AppError('No files uploaded', 400));
    }

    // Note: Images are already compressed by imageCompression middleware
    const uploadPromises = req.files.map((file) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'petmaza/products',
            resource_type: 'image',
            // Removed transformations as images are already compressed
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      });
    });

    const results: any[] = await Promise.all(uploadPromises);

    const uploadedImages = results.map((result) => ({
      url: result.secure_url,
      publicId: result.public_id,
    }));

    res.status(200).json({
      success: true,
      message: `${uploadedImages.length} images uploaded successfully`,
      data: { images: uploadedImages },
    });
  } catch (error: any) {
    next(new AppError(error.message || 'Error uploading images', 500));
  }
};

/**
 * Delete image from Cloudinary
 */
export const deleteImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      return next(new AppError('Public ID is required', 400));
    }

    await cloudinary.uploader.destroy(publicId);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error: any) {
    next(new AppError(error.message || 'Error deleting image', 500));
  }
};

/**
 * Upload a PDF file (e.g. lab report) to Cloudinary as raw resource
 */
export const uploadFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    const requestId = typeof req.body?.requestId === 'string' ? req.body.requestId.trim() : '';
    const birdIndexRaw = req.body?.birdIndex;

    if (requestId && birdIndexRaw !== undefined) {
      const birdIndex = Number(birdIndexRaw);
      if (!Number.isInteger(birdIndex) || birdIndex < 0) {
        return next(new AppError('Invalid bird index for lab report conversion', 400));
      }

      const serviceRequest: any = await ServiceRequest.findById(requestId);
      if (!serviceRequest) {
        return next(new AppError('Service request not found for lab report conversion', 404));
      }

      const bird = serviceRequest.birds?.[birdIndex];
      if (!bird) {
        return next(new AppError('Bird not found for lab report conversion', 404));
      }

      const extraction = await extractLabReportWithText(req.file.buffer, {
        bandId: bird.bandId,
        species: bird.species,
        birdIndex,
      });
      const sourceResult = await uploadRawPdfBuffer(req.file.buffer, 'petmaza/lab-reports/source');
      const rows = extraction.rows || [];

      if (!rows.length) {
        return res.status(422).json({
          success: false,
          message: 'Could not extract selectable rows from uploaded PDF.',
          data: {
            sourceUrl: sourceResult.secure_url,
            sourcePublicId: sourceResult.public_id,
            extracted: extraction.fields,
            extractedText: extraction.extractedText,
            csvText: extraction.csvText,
            rows,
          },
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Lab report rows extracted successfully. Select one row to convert.',
        data: {
          sourceUrl: sourceResult.secure_url,
          sourcePublicId: sourceResult.public_id,
          extracted: extraction.fields,
          extractedText: extraction.extractedText,
          csvText: extraction.csvText,
          rows,
        },
      });
    }

    const result: any = await uploadRawPdfBuffer(req.file.buffer, 'petmaza/lab-reports');

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        url: result.secure_url,
        publicId: result.public_id,
      },
    });
  } catch (error: any) {
    next(new AppError(error.message || 'Error uploading file', 500));
  }
};

export const convertSelectedLabReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { requestId, birdIndex, sourcePublicId, selectedRow } = req.body || {};
    const parsedBirdIndex = Number(birdIndex);

    if (!requestId || !sourcePublicId || !selectedRow || !Number.isInteger(parsedBirdIndex) || parsedBirdIndex < 0) {
      return next(new AppError('requestId, birdIndex, sourcePublicId and selectedRow are required', 400));
    }

    const serviceRequest: any = await ServiceRequest.findById(requestId);
    if (!serviceRequest) {
      return next(new AppError('Service request not found', 404));
    }

    const bird = serviceRequest.birds?.[parsedBirdIndex];
    if (!bird) {
      return next(new AppError('Bird not found in this request', 404));
    }

    const certId = typeof selectedRow.certId === 'string' ? selectedRow.certId.trim() : '';
    const result = typeof selectedRow.result === 'string' ? selectedRow.result.trim() : '';
    if (!certId || !result) {
      return next(new AppError('Selected row must contain certId and result', 400));
    }

    const sourcePdfBuffer = await fetchRawPdfBufferFromCloudinary(sourcePublicId);

    const converted = await convertPartnerLabPdfToPetmazaPdf(sourcePdfBuffer, {
      requestId,
      birdIndex: parsedBirdIndex,
      farmName: serviceRequest.farm,
      birdName: bird.birdName,
      bandId: bird.bandId,
      species: bird.species,
      customerName: serviceRequest.customerName,
      uploadedByName: req.user?.name,
    }, {
      bandId: selectedRow.ringId || selectedRow.bandId || bird.bandId,
      species: selectedRow.species || bird.species,
      submittedBy: selectedRow.submittedBy || req.user?.name,
      reportDate: selectedRow.reportDate,
      receivedDate: selectedRow.receivedDate,
      certId,
      result,
      specimen: selectedRow.specimen,
    });

    const convertedResult = await uploadRawPdfBuffer(converted.buffer, 'petmaza/lab-reports/converted');

    const certLabel = converted.extracted.certId ? ` | Cert ID: ${converted.extracted.certId}` : '';
    const resultLabel = converted.extracted.result ? ` | Result: ${converted.extracted.result}` : '';

    return res.status(200).json({
      success: true,
      message: 'Selected row converted successfully',
      data: {
        url: convertedResult.secure_url,
        publicId: convertedResult.public_id,
        verificationUrl: converted.verificationUrl,
        extracted: converted.extracted,
        note: `Petmaza converted report${certLabel}${resultLabel}`,
      },
    });
  } catch (error: any) {
    next(new AppError(error.message || 'Error converting selected row', 500));
  }
};

