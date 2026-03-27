import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';

// Load environment variables
dotenv.config();

const clearAllProducts = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB');

    // Get count before deletion
    const productCount = await Product.countDocuments();
    console.log(`📦 Found ${productCount} products in database`);

    if (productCount === 0) {
      console.log('✅ No products to delete');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will delete ALL products from the database!');
    console.log('⚠️  Categories, subcategories, users, and orders will NOT be affected.');
    console.log('\n🔄 Deleting all products...');

    // Delete all products
    const result = await Product.deleteMany({});
    
    console.log(`✅ Successfully deleted ${result.deletedCount} products`);
    
    // Verify deletion
    const remainingCount = await Product.countDocuments();
    console.log(`📦 Remaining products: ${remainingCount}`);

    // Close connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
clearAllProducts();
