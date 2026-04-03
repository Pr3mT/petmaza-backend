/**
 * Image Upload Utilities with Compression Support
 * 
 * This file demonstrates how to upload images using the new compression endpoints.
 * Place this in: src/utils/imageUpload.js (frontend)
 */

import { APIClient } from '../helpers/api_helper';

const api = new APIClient();

/**
 * Upload a single product image with optimized compression
 * Compression: 1200×1200px, WebP, 85% quality
 */
export const uploadProductImage = async (file) => {
  try {
    const formData = new FormData();
    formData.append('image', file);

    // Use optimized product endpoint
    const response = await api.post('/upload/product/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.success) {
      console.log('✅ Product image uploaded:', response.data.url);
      return response.data.url;
    } else {
      throw new Error(response.message || 'Upload failed');
    }
  } catch (error) {
    console.error('❌ Product image upload failed:', error);
    throw error;
  }
};

/**
 * Upload multiple product images with optimized compression
 * Max 5 images at once
 */
export const uploadProductImages = async (files) => {
  try {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('No files provided');
    }

    if (files.length > 5) {
      throw new Error('Maximum 5 images allowed');
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('images', file);
    });

    const response = await api.post('/upload/product/images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.success) {
      console.log(`✅ ${response.data.images.length} product images uploaded`);
      return response.data.images.map((img) => img.url);
    } else {
      throw new Error(response.message || 'Upload failed');
    }
  } catch (error) {
    console.error('❌ Product images upload failed:', error);
    throw error;
  }
};

/**
 * Upload a brand logo with transparency support
 * Compression: 500×500px, PNG, 90% quality
 */
export const uploadBrandLogo = async (file) => {
  try {
    const formData = new FormData();
    formData.append('image', file);

    // Use brand-optimized endpoint (PNG format for transparency)
    const response = await api.post('/upload/brand/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.success) {
      console.log('✅ Brand logo uploaded:', response.data.url);
      return response.data.url;
    } else {
      throw new Error(response.message || 'Upload failed');
    }
  } catch (error) {
    console.error('❌ Brand logo upload failed:', error);
    throw error;
  }
};

/**
 * Upload a hero banner with wide format optimization
 * Compression: 1920×800px, WebP, 85% quality
 */
export const uploadHeroBanner = async (file) => {
  try {
    const formData = new FormData();
    formData.append('image', file);

    // Use banner-optimized endpoint
    const response = await api.post('/upload/banner/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.success) {
      console.log('✅ Hero banner uploaded:', response.data.url);
      return response.data.url;
    } else {
      throw new Error(response.message || 'Upload failed');
    }
  } catch (error) {
    console.error('❌ Hero banner upload failed:', error);
    throw error;
  }
};

/**
 * Upload a promotional ad image
 * Compression: 1200×1200px, WebP, 80% quality
 */
export const uploadAdImage = async (file) => {
  try {
    const formData = new FormData();
    formData.append('image', file);

    // Use ad-optimized endpoint
    const response = await api.post('/upload/ad/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.success) {
      console.log('✅ Ad image uploaded:', response.data.url);
      return response.data.url;
    } else {
      throw new Error(response.message || 'Upload failed');
    }
  } catch (error) {
    console.error('❌ Ad image upload failed:', error);
    throw error;
  }
};

/**
 * Upload a general image (fallback)
 * Compression: 1000×1000px, WebP, 80% quality
 */
export const uploadImage = async (file) => {
  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await api.post('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.success) {
      console.log('✅ Image uploaded:', response.data.url);
      return response.data.url;
    } else {
      throw new Error(response.message || 'Upload failed');
    }
  } catch (error) {
    console.error('❌ Image upload failed:', error);
    throw error;
  }
};

/**
 * Delete an image from Cloudinary
 */
export const deleteImage = async (publicId) => {
  try {
    const response = await api.delete('/upload/image', { publicId });

    if (response.success) {
      console.log('✅ Image deleted:', publicId);
      return true;
    } else {
      throw new Error(response.message || 'Delete failed');
    }
  } catch (error) {
    console.error('❌ Image deletion failed:', error);
    throw error;
  }
};

/**
 * Validate image file before upload
 */
export const validateImageFile = (file, options = {}) => {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  } = options;

  // Check file size
  if (file.size > maxSize) {
    throw new Error(`File size must be less than ${(maxSize / 1024 / 1024).toFixed(1)}MB`);
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`File type must be one of: ${allowedTypes.join(', ')}`);
  }

  return true;
};

/**
 * Get optimized image preview URL
 * Useful for showing preview before upload
 */
export const getImagePreviewUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      resolve(e.target.result);
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsDataURL(file);
  });
};

/**
 * Example usage in a React component
 */
export const ImageUploadExample = () => {
  const handleProductImageUpload = async (event) => {
    const file = event.target.files[0];
    
    if (!file) return;
    
    try {
      // Validate file
      validateImageFile(file);
      
      // Show preview
      const previewUrl = await getImagePreviewUrl(file);
      console.log('Preview URL:', previewUrl);
      
      // Upload with compression
      const uploadedUrl = await uploadProductImage(file);
      console.log('Uploaded URL:', uploadedUrl);
      
      // Use the URL in your product data
      // e.g., setProduct({ ...product, image: uploadedUrl });
      
    } catch (error) {
      console.error('Upload error:', error);
      // Show error to user
    }
  };

  const handleMultipleImagesUpload = async (event) => {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;
    
    try {
      // Validate all files
      files.forEach(file => validateImageFile(file));
      
      // Upload multiple images
      const uploadedUrls = await uploadProductImages(files);
      console.log('Uploaded URLs:', uploadedUrls);
      
      // Use the URLs in your product data
      // e.g., setProduct({ ...product, images: uploadedUrls });
      
    } catch (error) {
      console.error('Upload error:', error);
      // Show error to user
    }
  };

  return {
    handleProductImageUpload,
    handleMultipleImagesUpload,
  };
};

// Export all functions
export default {
  uploadProductImage,
  uploadProductImages,
  uploadBrandLogo,
  uploadHeroBanner,
  uploadAdImage,
  uploadImage,
  deleteImage,
  validateImageFile,
  getImagePreviewUrl,
};
