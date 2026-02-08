import mongoose from 'mongoose';
import Product from '../models/Product';
import Category from '../models/Category';
import Brand from '../models/Brand';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/petmaza';

interface IWeightVariant {
  weight: number;
  unit: string;
  displayWeight: string;
  mrp: number;
  sellingPercentage: number;
  sellingPrice: number;
  discount: number;
  purchasePercentage: number;
  purchasePrice: number;
  isActive: boolean;
}

async function convertVariantsToProducts() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all products with variants
    const variantProducts = await Product.find({ 
      hasVariants: true,
      variants: { $exists: true, $ne: [] }
    });

    console.log(`Found ${variantProducts.length} products with variants`);

    for (const product of variantProducts) {
      console.log(`\nProcessing: ${product.name}`);
      
      const variants = product.variants as IWeightVariant[];
      
      if (!variants || variants.length === 0) {
        console.log('  No variants found, skipping...');
        continue;
      }

      // Create separate product for each variant
      for (const variant of variants) {
        const variantProductName = `${product.name} - ${variant.displayWeight}`;
        
        // Check if variant product already exists
        const existingVariantProduct = await Product.findOne({
          name: variantProductName,
          brand_id: product.brand_id
        });

        if (existingVariantProduct) {
          console.log(`  ✓ Already exists: ${variantProductName}`);
          continue;
        }

        // Create new product for this variant
        const newProduct = new Product({
          name: variantProductName,
          description: product.description,
          category_id: product.category_id,
          brand_id: product.brand_id,
          
          // Single weight product fields
          weight: variant.weight,
          unit: variant.unit,
          mrp: variant.mrp,
          sellingPercentage: variant.sellingPercentage,
          sellingPrice: variant.sellingPrice,
          discount: variant.discount,
          purchasePercentage: variant.purchasePercentage,
          purchasePrice: variant.purchasePrice,
          
          // Copy other properties
          images: product.images,
          isPrime: product.isPrime,
          isActive: variant.isActive && product.isActive,
          inStock: variant.isActive,
          
          // Mark as non-variant product
          hasVariants: false,
          variants: [],
          
          // Link to parent product
          parentProduct: product._id,
          variantInfo: {
            weight: variant.weight,
            unit: variant.unit,
            displayWeight: variant.displayWeight
          }
        });

        await newProduct.save();
        console.log(`  ✓ Created: ${variantProductName} (${newProduct._id})`);
      }

      // Mark original product as inactive (don't delete for data integrity)
      product.isActive = false;
      product.inStock = false;
      await product.save();
      console.log(`  ✓ Marked original product as inactive: ${product.name}`);
    }

    console.log('\n✅ Conversion completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during conversion:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
convertVariantsToProducts()
  .then(() => {
    console.log('Script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
