import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './src/models/Order';
import EmailLog from './src/models/EmailLog';

dotenv.config();

const diagnose = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    // Check recent orders
    console.log('📦 RECENT ORDERS:');
    const orders = await Order.find().sort({ createdAt: -1 }).limit(5).lean();
    
    if (orders.length === 0) {
      console.log('   ❌ No orders found in database');
    } else {
      orders.forEach((order: any, i: number) => {
        console.log(`\n   ${i + 1}. Order ID: ${order._id}`);
        console.log(`      Customer: ${order.customer_id}`);
        console.log(`      Status: ${order.status}`);
        console.log(`      Created: ${order.createdAt}`);
        console.log(`      Total: ₹${order.totalAmount}`);
      });
    }

    // Check recent emails
    console.log('\n\n📧 RECENT EMAILS IN DATABASE:');
    const emails = await EmailLog.find().sort({ timestamp: -1 }).limit(10).lean();
    
    if (emails.length === 0) {
      console.log('   ❌ No emails found in database');
    } else {
      emails.forEach((email: any, i: number) => {
        console.log(`\n   ${i + 1}. To: ${email.recipient}`);
        console.log(`      Subject: ${email.subject}`);
        console.log(`      Type: ${email.trigger}`);
        console.log(`      Status: ${email.status}`);
        if (email.status === 'failed') {
          console.log(`      ❌ Error: ${email.error}`);
        }
        console.log(`      Time: ${email.timestamp}`);
      });
    }

    // Check for order confirmation emails specifically
    console.log('\n\n🔍 ORDER CONFIRMATION EMAILS:');
    const confirmations = await EmailLog.find({ trigger: 'order_confirmation' })
      .sort({ timestamp: -1 })
      .limit(5)
      .lean();
    
    if (confirmations.length === 0) {
      console.log('   ❌ No order confirmation emails sent yet!');
      console.log('   This means: Orders are being created but email sending is NOT being triggered');
    } else {
      confirmations.forEach((email: any, i: number) => {
        console.log(`\n   ${i + 1}. To: ${email.recipient}`);
        console.log(`      Status: ${email.status}`);
        console.log(`      Order ID: ${email.orderId}`);
        if (email.status === 'failed') {
          console.log(`      ❌ Error: ${email.error}`);
        }
      });
    }

    console.log('\n\n📊 SUMMARY:');
    const totalOrders = await Order.countDocuments();
    const totalEmails = await EmailLog.countDocuments();
    const sentEmails = await EmailLog.countDocuments({ status: 'sent' });
    const failedEmails = await EmailLog.countDocuments({ status: 'failed' });
    
    console.log(`   Total Orders: ${totalOrders}`);
    console.log(`   Total Emails: ${totalEmails}`);
    console.log(`   Sent: ${sentEmails} ✅`);
    console.log(`   Failed: ${failedEmails} ❌`);

    if (totalOrders > sentEmails) {
      console.log('\n   ⚠️  WARNING: Orders exist but fewer emails were sent!');
      console.log('   This suggests order confirmation emails are not being triggered');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Diagnostic failed:', error.message);
    process.exit(1);
  }
};

diagnose();
