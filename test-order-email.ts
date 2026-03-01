import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { sendOrderConfirmationEmail } from './src/services/emailer';

dotenv.config();

const testOrderEmail = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    const testOrderData = {
      totalAmount: 5999,
      items: [
        { product: { name: 'Dog Food Premium 10kg' }, quantity: 1 },
        { product: { name: 'Pet Shampoo' }, quantity: 2 },
      ],
      customerAddress: '123 Pet Street, Mumbai 400001, India',
    };

    const customerEmail = 'samrudhiamrutkar15@gmail.com'; // YOUR EMAIL
    const customerName = 'Test Customer';
    const orderId = 'TEST-ORDER-' + Date.now();

    console.log('📧 Sending Test Order Confirmation Email...');
    console.log(`   To: ${customerEmail}`);
    console.log(`   Order ID: ${orderId}\n`);

    await sendOrderConfirmationEmail(customerEmail, customerName, orderId, testOrderData);

    console.log('✅ Order confirmation email sent successfully!');
    console.log('📍 Check your inbox/spam folder for the email\n');

    // Check EmailLog
    const { default: EmailLog } = await import('./src/models/EmailLog');
    const logs = await EmailLog.find({ trigger: 'order_confirmation' }).sort({ timestamp: -1 }).limit(3);

    console.log('📋 Recent Order Confirmation Emails in Database:');
    logs.forEach((log: any, index: number) => {
      console.log(`\n   ${index + 1}. To: ${log.recipient}`);
      console.log(`      Status: ${log.status}`);
      console.log(`      Time: ${log.timestamp}`);
      if (log.error) console.log(`      Error: ${log.error}`);
    });

    console.log('\n✅ Test complete!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
};

testOrderEmail();
