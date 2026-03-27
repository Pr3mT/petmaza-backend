import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';

// Load environment variables
dotenv.config();

const previewProducts = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB\n');

    // Get total count
    const totalCount = await Product.countDocuments();
    console.log(`📦 Total Products: ${totalCount}\n`);

    if (totalCount === 0) {
      console.log('✅ No products found in database');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Get products grouped by category
    const productsByCategory = await Product.aggregate([
      {
        $group: {
          _id: '$mainCategory',
          count: { $sum: 1 },
          subcategories: { $addToSet: '$subCategory' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('📊 Products by Category:\n');
    productsByCategory.forEach((cat: any) => {
      console.log(`  ${cat._id}: ${cat.count} products`);
      if (cat.subcategories && cat.subcategories.length > 0) {
        cat.subcategories.forEach((sub: string) => {
          if (sub) console.log(`    └─ ${sub}`);
        });
      }
    });

    // Get sample products
    console.log('\n📋 Sample Products (first 10):\n');
    const sampleProducts = await Product.find()
      .select('name mainCategory subCategory mrp brand_id')
      .populate('brand_id', 'name')
      .limit(10)
      .lean();

    sampleProducts.forEach((product: any, index: number) => {
      console.log(`  ${index + 1}. ${product.name}`);
      console.log(`     Category: ${product.mainCategory} > ${product.subCategory}`);
      console.log(`     Brand: ${product.brand_id?.name || 'N/A'} | MRP: ₹${product.mrp || 'N/A'}`);
      console.log('');
    });

    if (totalCount > 10) {
      console.log(`  ... and ${totalCount - 10} more products`);
    }

    console.log('\n⚠️  To delete all these products, run:');
    console.log('   npx ts-node clear-all-products.ts\n');

    // Close connection
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
previewProducts();
