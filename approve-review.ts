import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Review from './src/models/Review';

dotenv.config();

const approveReview = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/petmaza');
    console.log('✅ Connected to MongoDB');

    // Find the review for this product (the "xyz" review)
    const productId = '69c643d669a6f7938d07bc71';
    
    const review = await Review.findOne({ 
      product_id: productId 
    }).sort({ createdAt: -1 }); // Get most recent review

    if (!review) {
      console.log('❌ No review found for this product');
      process.exit(0);
    }

    console.log('\n📝 Review found:');
    console.log('   ID:', review._id);
    console.log('   Rating:', review.rating);
    console.log('   Comment:', review.comment);
    console.log('   Current Status:', review.status);

    if (review.status === 'approved') {
      console.log('\n✅ Review is already approved!');
      process.exit(0);
    }

    // Approve the review
    review.status = 'approved';
    review.moderatedAt = new Date();
    await review.save();

    console.log('\n✅ Review approved successfully!');
    console.log('   New Status:', review.status);
    console.log('\n🎉 The review will now appear in product highlights!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

approveReview();
