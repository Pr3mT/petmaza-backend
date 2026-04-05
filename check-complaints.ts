import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Complaint from './src/models/Complaint';
import Product from './src/models/Product';
import User from './src/models/User';

dotenv.config();

const checkComplaints = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected to MongoDB');

    // Get all complaints
    const complaints = await Complaint.find()
      .sort({ createdAt: -1 })
      .limit(10);

    console.log(`\n📋 Found ${complaints.length} complaints:\n`);

    for (const complaint of complaints) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Complaint ID: ${complaint._id}`);
      console.log(`Subject: ${complaint.subject}`);
      console.log(`Status: ${complaint.status}`);
      console.log(`Issue Type: ${complaint.issueType || 'N/A'}`);
      console.log(`Customer ID: ${complaint.customer_id}`);
      console.log(`Product: ${complaint.productName}`);
      console.log(`Product ID: ${complaint.product_id}`);
      console.log(`Vendor ID: ${complaint.vendor_id || 'NOT SET ❌'}`);
      console.log(`Fulfiller ID: ${complaint.fulfiller_id || 'NOT SET'}`);
      console.log(`Order ID: ${complaint.order_id || 'NOT SET'}`);
      console.log(`Created: ${complaint.createdAt}`);
      console.log('');
    }

    // Check if there are complaints with no vendor_id
    const complaintsWithoutVendor = await Complaint.countDocuments({ vendor_id: { $exists: false } });
    const complaintsWithNullVendor = await Complaint.countDocuments({ vendor_id: null });
    
    console.log('\n📊 Statistics:');
    console.log(`Total complaints: ${complaints.length}`);
    console.log(`Complaints without vendor_id field: ${complaintsWithoutVendor}`);
    console.log(`Complaints with null vendor_id: ${complaintsWithNullVendor}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
};

checkComplaints();
