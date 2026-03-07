// Quick script to update existing hero banners to have bannerType field
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/petmaza';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Update all hero banners that don't have bannerType to set it to 'image'
    const result = await mongoose.connection.db.collection('herobanners').updateMany(
      { bannerType: { $exists: false } },
      { $set: { bannerType: 'image' } }
    );
    
    console.log(`Updated ${result.modifiedCount} banners to have bannerType: 'image'`);
    
    // Show all banners
    const banners = await mongoose.connection.db.collection('herobanners').find({}).toArray();
    console.log('\nAll banners:');
    banners.forEach(banner => {
      console.log(`- ${banner.title || 'Untitled'}: bannerType = ${banner.bannerType}, active = ${banner.isActive}`);
    });
    
    mongoose.disconnect();
    console.log('\nDone! Refresh your page now.');
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
