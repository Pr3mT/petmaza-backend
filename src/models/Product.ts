import mongoose, { Schema } from 'mongoose';
import { IProduct, IWeightVariant } from '../types';

const weightVariantSchema = new Schema<IWeightVariant>({
  weight: {
    type: Number,
    required: true,
    min: 0,
  },
  unit: {
    type: String,
    required: true,
    enum: ['g', 'kg', 'ml', 'l'],
  },
  displayWeight: {
    type: String,
    required: true,
  },
  mrp: {
    type: Number,
    required: true,
    min: 0,
  },
  sellingPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  sellingPrice: {
    type: Number,
    min: 0,
    default: 0,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  purchasePercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 60,
  },
  purchasePrice: {
    type: Number,
    min: 0,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { _id: true }); // Enable _id for each variant

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Please provide a product name'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category_id: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Please provide a category'],
    },
    brand_id: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      required: [true, 'Please provide a brand'],
    },
    // Legacy fields (kept for backward compatibility)
    weight: {
      type: Number,
      min: 0,
    },
    mrp: {
      type: Number,
      min: 0,
    },
    sellingPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    sellingPrice: {
      type: Number,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    purchasePercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 60,
    },
    purchasePrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    // New variant system (DEPRECATED - keeping for backward compatibility)
    hasVariants: {
      type: Boolean,
      default: false,
    },
    variants: {
      type: [weightVariantSchema],
      default: [],
    },
    // New separate product approach for variants
    parentProduct: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    variantInfo: {
      weight: {
        type: Number,
        default: null,
      },
      unit: {
        type: String,
        enum: ['g', 'kg', 'ml', 'l', null],
        default: null,
      },
      displayWeight: {
        type: String,
        default: null,
      },
    },
    isPrime: {
      type: Boolean,
      default: false,
    },
    primeVendor_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: function() {
        return this.isPrime === true;
      },
    },
    images: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-calculate selling price, discount, and purchase price before saving
productSchema.pre('save', function (next) {
  // Handle variants
  if (this.hasVariants && this.variants && this.variants.length > 0) {
    this.variants.forEach((variant: any) => {
      const mrp = variant.mrp;
      const sellingPercentage = variant.sellingPercentage;
      const purchasePercentage = variant.purchasePercentage || 60;
      
      // Calculate selling price
      variant.sellingPrice = mrp * (sellingPercentage / 100);
      
      // Calculate discount percentage
      if (mrp > 0) {
        const discount = ((mrp - variant.sellingPrice) / mrp) * 100;
        variant.discount = Math.round(discount * 100) / 100;
      }
      
      // Calculate purchase price
      variant.purchasePrice = mrp * (purchasePercentage / 100);
    });
    
    // Set default values for legacy fields when using variants to prevent NaN
    if (!this.get('sellingPrice') || isNaN(this.get('sellingPrice'))) {
      this.set('sellingPrice', 0);
    }
    if (!this.get('purchasePrice') || isNaN(this.get('purchasePrice'))) {
      this.set('purchasePrice', 0);
    }
    if (!this.get('mrp') || isNaN(this.get('mrp'))) {
      this.set('mrp', 0);
    }
  }
  
  // Handle legacy single-weight products
  if (!this.hasVariants) {
    const mrp = this.get('mrp') as number;
    
    if (mrp && (this.isModified('mrp') || this.isModified('sellingPercentage'))) {
      const sellingPercentage = this.get('sellingPercentage') as number;
      const sellingPrice = mrp * (sellingPercentage / 100);
      this.set('sellingPrice', sellingPrice);
      
      // Auto-calculate discount percentage
      if (mrp > 0) {
        const discount = ((mrp - sellingPrice) / mrp) * 100;
        this.set('discount', Math.round(discount * 100) / 100); // Round to 2 decimal places
      }
    }
    
    if (mrp && (this.isModified('mrp') || this.isModified('purchasePercentage'))) {
      const purchasePercentage = this.get('purchasePercentage') as number;
      this.set('purchasePrice', mrp * (purchasePercentage / 100));
    }
  }
  
  next();
});

// Indexes
productSchema.index({ category_id: 1 });
productSchema.index({ brand_id: 1 });
productSchema.index({ isPrime: 1 });
productSchema.index({ isActive: 1 });

const Product = mongoose.model<IProduct>('Product', productSchema);

export default Product;
