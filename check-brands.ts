import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Brand from './src/models/Brand';

dotenv.config();

async function checkBrands() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    
    const brands = await Brand.find({});
    console.log(`\nTotal brands: ${brands.length}\n`);
    
    brands.forEach(b => {
      console.log(`${b.name} (${b.isActive ? 'Active' : 'Inactive'})`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
}

checkBrands();
