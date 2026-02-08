import mongoose from 'mongoose';
import Product from '../models/Product';
import dotenv from 'dotenv';

dotenv.config();

const checkLatestProduct = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    const product = await Product.findOne().sort({ createdAt: -1 });
    
    if (product) {
      console.log('\n=== Latest Product ===');
      console.log('Name:', product.name);
      console.log('Images:', product.images);
      console.log('Images count:', product.images?.length || 0);
      console.log('Full product:', JSON.stringify(product, null, 2));
    } else {
      console.log('No products found');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkLatestProduct();
