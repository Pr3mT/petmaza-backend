import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Complaint from './src/models/Complaint';

dotenv.config();

const updateComplaint = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB');

    const complaint = await Complaint.findById('69d2404161609b650f71fd1b');
    
    if (complaint) {
      complaint.issueType = 'product_quality';
      complaint.description = 'The product quality is not as expected. The LED light stopped working after 2 days of use.';
      await complaint.save();
      
      console.log('✅ Updated complaint:');
      console.log('   Issue Type:', complaint.issueType);
      console.log('   Description:', complaint.description);
    } else {
      console.log('❌ Complaint not found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
};

updateComplaint();
