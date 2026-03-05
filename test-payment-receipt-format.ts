import { sendPaymentSuccessEmail } from './src/services/emailer';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function testPaymentReceipt() {
  try {
    console.log('🧪 Testing Payment Receipt Email Format...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/petmaza';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Test payment receipt data
    const testData = {
      customerEmail: 'samruddhiamrutkar15@gmail.com',
      customerName: 'Samruddhi Amrutkar',
      orderId: '#a00de009',
      paymentId: 'pay_demo_1772706066400',
      amount: 970.00,
      orderData: {
        items: [
          {
            product_id: {
              name: 'PetSafe Retractable Dog Leash 5m'
            },
            quantity: 1,
            price: 960.00,
            subtotal: 960.00
          }
        ],
        customerAddress: {
          street: 'Uran',
          city: 'Navi Mumbai',
          state: 'Maharashtra',
          pincode: '400702'
        },
        paymentGateway: 'razorpay',
        paymentMethod: 'Online Payment'
      }
    };

    console.log('📧 Sending test payment receipt email...');
    console.log(`   → To: ${testData.customerEmail}`);
    console.log(`   → Amount: ₹${testData.amount.toFixed(2)}`);
    console.log(`   → Order ID: ${testData.orderId}\n`);

    await sendPaymentSuccessEmail(
      testData.customerEmail,
      testData.customerName,
      testData.orderId,
      testData.amount,
      testData.paymentId,
      testData.orderData
    );

    console.log('✅ Payment receipt email sent successfully!\n');
    console.log('📬 Check your inbox for:');
    console.log('   ✓ PETMAZA header (centered, no invalid symbols)');
    console.log('   ✓ Check mark icon (properly displayed)');
    console.log('   ✓ Amount Paid text (consistent font size)');
    console.log('   ✓ Currency symbol (₹) displayed correctly');
    console.log('   ✓ Delivery address (properly formatted)\n');

    await mongoose.connection.close();
    console.log('✅ Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testPaymentReceipt();
