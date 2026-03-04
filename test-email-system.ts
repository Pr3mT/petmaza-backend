import {
  sendOrderConfirmationEmail,
  sendPaymentSuccessEmail,
} from './src/services/emailer';

async function testEmailSystem() {
  try {
    console.log('🧪 Testing Order Confirmation Email...');
    
    await sendOrderConfirmationEmail(
      'test@example.com', // Use a test email
      'Test Customer',
      '#TEST123',
      {
        totalAmount: 1000,
        items: [
          {
            product_id: { name: 'Test Product' },
            quantity: 2,
          },
        ],
        customerAddress: 'Test Address, Mumbai 400001',
      }
    );
    
    console.log('✅ Order Confirmation Email function works!');
    
    console.log('\n🧪 Testing Payment Success Email...');
    
    await sendPaymentSuccessEmail(
      'test@example.com',
      'Test Customer',
      '#TEST123',
      1000,
      'pay_test123456',
      {
        items: [
          {
            product_id: { name: 'Test Product' },
            quantity: 2,
            subtotal: 1000,
          },
        ],
        customerAddress: {
          street: 'Test Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        },
        paymentGateway: 'Razorpay',
        paymentMethod: 'Online Payment',
      }
    );
    
    console.log('✅ Payment Success Email function works!');
    console.log('\n✅ All email functions are working correctly!');
    console.log('\nℹ️ Check the emaillogs collection in MongoDB to see if emails were logged.');
    
  } catch (error: any) {
    console.error('❌ Email test failed:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

testEmailSystem();
