import mongoose from 'mongoose';
import Product from '../models/Product';
import dotenv from 'dotenv';

dotenv.config();

const showAllProductsWithImages = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB\n');

    const products = await Product.find().sort({ createdAt: -1 }).limit(10);
    
    console.log(`Found ${products.length} products:\n`);
    
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   ID: ${product._id}`);
      console.log(`   Images: ${product.images?.length || 0}`);
      if (product.images && product.images.length > 0) {
        product.images.forEach((img, i) => {
          console.log(`      ${i + 1}. ${img}`);
        });
      }
      console.log('');
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

showAllProductsWithImages();
