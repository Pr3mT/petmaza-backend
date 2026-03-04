import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User';
import Order from './models/Order';
import EmailLog from './models/EmailLog';

dotenv.config();

const fullDiagnostic = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    // Get all vendors
    const vendors = await User.find({ role: 'vendor' }).select('_id name vendorType').lean();
    const vendorMap = Object.fromEntries(vendors.map((v: any) => [v._id.toString(), `${v.name} (${v.vendorType})`]));

    // Check RECENT orders
    console.log('📦 RECENT ORDERS WITH ASSIGNMENTS:');
    const recentOrders = await Order.find()
      .select('_id status assignedVendorId isPrime createdAt payment_status')
      .populate('customer_id', 'email')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    recentOrders.forEach((o: any, i: number) => {
      const vendorName = o.assignedVendorId ? vendorMap[o.assignedVendorId.toString()] || 'UNKNOWN' : 'NOT ASSIGNED';
      console.log(`\n${i + 1}. Order ${o._id}`);
      console.log(`   Status: ${o.status} | Payment: ${o.payment_status}`);
      console.log(`   Assigned to: ${vendorName}`);
      console.log(`   Prime: ${o.isPrime ? 'YES' : 'NO'}`);
      console.log(`   Customer Email: ${(o.customer_id as any)?.email || 'N/A'}`);
    });

    // Check emails
    console.log('\n\n📧 RECENT EMAILS:');
    const recentEmails = await EmailLog.find()
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();
    
    let sentCount = 0, failedCount = 0;
    recentEmails.forEach((e: any, i: number) => {
      if (e.status === 'sent') sentCount++;
      if (e.status === 'failed') failedCount++;
      
      const statusIcon = e.status === 'sent' ? '✅' : '❌';
      console.log(`\n${i + 1}. ${statusIcon} ${e.trigger}`);
      console.log(`   To: ${e.recipient}`);
      console.log(`   Subject: ${e.subject}`);
      if (e.status === 'failed') {
        console.log(`   Error: ${e.error.substring(0, 100)}...`);
      }
    });

    console.log('\n\n📊 SUMMARY:');
    console.log(`Total Orders: ${await Order.countDocuments()}`);
    console.log(`Total Emails: ${await EmailLog.countDocuments()}`);
    console.log(`✅ Sent: ${sentCount}`);
    console.log(`❌ Failed: ${failedCount}`);

    console.log('\n\n🔍 DIAGNOSIS:');
    const assignedOrders = recentOrders.filter((o: any) => o.assignedVendorId);
    if (assignedOrders.length === recentOrders.length) {
      console.log('✅ All orders are assigned to vendors - GOOD!');
    } else {
      console.log(`⚠️  ${recentOrders.length - assignedOrders.length} orders are NOT assigned`);
    }

    if (failedCount > 0) {
      console.log(`⚠️  ${failedCount} emails failed to send`);
      console.log('   Check if backend is running and .env is correct');
    }

    if (sentCount > 0) {
      console.log(`✅ ${sentCount} emails sent successfully!`);
    } else if (recentOrders.length > 0) {
      console.log('⚠️  No emails sent for recent orders');
      console.log('   The backend may not be running or restarted since email fix');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

fullDiagnostic();
