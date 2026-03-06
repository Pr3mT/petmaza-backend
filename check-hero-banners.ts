import mongoose from 'mongoose';
import dotenv from 'dotenv';
import HeroBanner from './src/models/HeroBanner';

dotenv.config();

async function checkBanners() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected!\n');

    // Get all banners
    const allBanners = await HeroBanner.find({});
    console.log('=== ALL BANNERS ===');
    console.log(`Total banners: ${allBanners.length}\n`);
    
    allBanners.forEach((banner, index) => {
      console.log(`Banner #${index + 1}:`);
      console.log(`  ID: ${banner._id}`);
      console.log(`  Title: ${banner.title}`);
      console.log(`  Subtitle: ${banner.subtitle}`);
      console.log(`  isActive: ${banner.isActive}`);
      console.log(`  displayOrder: ${banner.displayOrder}`);
      console.log(`  Image: ${banner.image}`);
      console.log(`  Created: ${banner.createdAt}`);
      console.log('---\n');
    });

    // Get only active banners
    const activeBanners = await HeroBanner.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 });
    console.log('=== ACTIVE BANNERS ===');
    console.log(`Total active banners: ${activeBanners.length}\n`);
    
    activeBanners.forEach((banner, index) => {
      console.log(`Active Banner #${index + 1}:`);
      console.log(`  ID: ${banner._id}`);
      console.log(`  Title: ${banner.title}`);
      console.log(`  Subtitle: ${banner.subtitle}`);
      console.log('---\n');
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkBanners();
