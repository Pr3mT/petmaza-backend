import mongoose from 'mongoose';
import Product from '../models/Product';
import Category from '../models/Category';
import Brand from '../models/Brand';

const MONGO_URI = 'mongodb://localhost:27017/pet-marketplace';

async function seedVariantProducts() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Get category and brand
    const dogCategory = await Category.findOne({ name: 'Dog Food' });
    const purepetBrand = await Brand.findOne({ name: 'Purepet' });

    if (!dogCategory || !purepetBrand) {
      console.error('❌ Category or Brand not found. Please seed categories and brands first.');
      process.exit(1);
    }

    // Delete existing Purepet products
    await Product.deleteMany({ name: 'Purepet Adult Dog Food' });
    console.log('✓ Deleted existing Purepet products');

    // Create new product with variants (MongoDB will auto-generate _id for each variant)
    const purepetProduct = await Product.create({
      name: 'Purepet Adult Dog Food',
      description: 'Premium quality adult dog food with chicken and vegetables. Complete nutrition for your pet.',
      category_id: dogCategory._id,
      brand_id: purepetBrand._id,
      hasVariants: true,
      variants: [
        {
          weight: 200,
          unit: 'g',
          displayWeight: '200g',
          mrp: 60,
          sellingPercentage: 80,
          sellingPrice: 48,
          discount: 20,
          purchasePercentage: 60,
          purchasePrice: 36,
          isActive: true
        },
        {
          weight: 500,
          unit: 'g',
          displayWeight: '500g',
          mrp: 150,
          sellingPercentage: 80,
          sellingPrice: 120,
          discount: 20,
          purchasePercentage: 60,
          purchasePrice: 90,
          isActive: true
        },
        {
          weight: 1,
          unit: 'kg',
          displayWeight: '1kg',
          mrp: 200,
          sellingPercentage: 80,
          sellingPrice: 160,
          discount: 20,
          purchasePercentage: 60,
          purchasePrice: 120,
          isActive: true
        },
        {
          weight: 5,
          unit: 'kg',
          displayWeight: '5kg',
          mrp: 500,
          sellingPercentage: 80,
          sellingPrice: 400,
          discount: 20,
          purchasePercentage: 60,
          purchasePrice: 300,
          isActive: true
        }
      ],
      isPrime: false,
      images: [
        'https://res.cloudinary.com/dknzmdxjy/image/upload/v1769955335/petmaza/products/fk5rbzovzgylgzixp8ch.jpg',
        'https://res.cloudinary.com/dknzmdxjy/image/upload/v1769955344/petmaza/products/jdc5gfqlz0xckugl9nhu.jpg'
      ],
      isActive: true
    });

    console.log('\n✅ Product created successfully!');
    console.log('Product ID:', purepetProduct._id);
    console.log('Variants with IDs:');
    purepetProduct.variants.forEach((variant, idx) => {
      console.log(`  ${idx + 1}. ${variant.displayWeight} (ID: ${variant._id}) - ₹${variant.sellingPrice}`);
    });

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedVariantProducts();
