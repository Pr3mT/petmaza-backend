import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Review from './src/models/Review';

dotenv.config();

const checkReview = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/petmaza');
    console.log('✅ Connected to MongoDB\n');

    const productId = '69c643d669a6f7938d07bc71';
    
    console.log('🔍 Searching for reviews with product_id:', productId);
    
    // Check if product_id is stored as ObjectId or string
    const reviewsAsObjectId = await Review.find({ 
      product_id: new mongoose.Types.ObjectId(productId) 
    });
    
    const reviewsAsString = await Review.find({ 
      product_id: productId 
    });
    
    console.log('\n📊 Results:');
    console.log('   Reviews found (as ObjectId):', reviewsAsObjectId.length);
    console.log('   Reviews found (as String):', reviewsAsString.length);
    
    if (reviewsAsObjectId.length > 0) {
      console.log('\n✅ Found reviews! Details:');
      reviewsAsObjectId.forEach((review, idx) => {
        console.log(`\n   Review ${idx + 1}:`);
        console.log('      ID:', review._id);
        console.log('      Product ID:', review.product_id);
        console.log('      Product ID Type:', typeof review.product_id);
        console.log('      Rating:', review.rating);
        console.log('      Comment:', review.comment);
        console.log('      Status:', review.status);
      });
    } else if (reviewsAsString.length > 0) {
      console.log('\n✅ Found reviews (as string)! Details:');
      reviewsAsString.forEach((review, idx) => {
        console.log(`\n   Review ${idx + 1}:`);
        console.log('      ID:', review._id);
        console.log('      Product ID:', review.product_id);
        console.log('      Product ID Type:', typeof review.product_id);
        console.log('      Rating:', review.rating);
        console.log('      Comment:', review.comment);
        console.log('      Status:', review.status);
      });
    } else {
      console.log('\n❌ No reviews found for this product!');
      
      // Let's see what product IDs exist in reviews
      const allReviews = await Review.find().limit(5);
      console.log('\n📝 Sample of existing reviews:');
      allReviews.forEach((review, idx) => {
        console.log(`   ${idx + 1}. Product ID: ${review.product_id} (Type: ${typeof review.product_id})`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkReview();
