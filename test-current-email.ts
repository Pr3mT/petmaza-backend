import dotenv from 'dotenv';
dotenv.config();

import { sendOrderConfirmationEmail, sendPaymentSuccessEmail } from './src/services/emailer';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://prem:8007@cluster0.vgjkl.mongodb.net/pet-marketplace?retryWrites=true&w=majority';

async function testEmails() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected\n');

    console.log('📧 Testing email system...\n');

    // Test 1: Order confirmation email
    console.log('Test 1: Order Confirmation Email');
    const result1 = await sendOrderConfirmationEmail(
      'samruddhiamrutkar15@gmail.com',
      'Test Customer',
      '#ORD123',
      {
        totalAmount: 1500,
        items: [
          {
            product_id: { name: 'Dog Food Premium', images: [] },
            quantity: 2,
            price: 500,
            totalPrice: 1000,
          },
        ],
        customerAddress: '123 Test Street, Mumbai',
        shippingCharges: 100,
        platformFee: 50,
        subtotal: 1350,
      }
    );
    console.log('✅ Order confirmation result:', result1);
    console.log('');

    // Test 2: Payment success email
    console.log('Test 2: Payment Success Email');
    const result2 = await sendPaymentSuccessEmail(
      'samruddhiamrutkar15@gmail.com',
      'Test Customer',
      '#ORD123',
      1500,
      'pay_test123456',
      {
        items: [
          {
            product_id: { name: 'Dog Food Premium', images: [] },
            quantity: 2,
            price: 500,
            totalPrice: 1000,
          },
        ],
        customerAddress: '123 Test Street, Mumbai',
        paymentGateway: 'Razorpay',
        paymentMethod: 'Online Payment',
      }
    );
    console.log('✅ Payment success result:', result2);
    console.log('');

    console.log('🎉 All emails sent successfully!');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Email test failed:', error.message);
    console.error('Stack:', error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testEmails();
