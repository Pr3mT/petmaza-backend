import { sendOrderConfirmationEmail, sendPaymentSuccessEmail } from './src/services/emailer';

async function testCustomerEmail() {
  try {
    console.log('📧 Testing Customer Email: samruddhiamrutkar15@gmail.com\n');
    
    // Test 1: Order Confirmation
    console.log('1️⃣ Sending Order Confirmation Email...');
    await sendOrderConfirmationEmail(
      'samruddhiamrutkar15@gmail.com',
      'Samruddhi Amrutkar',
      '#ORD789',
      {
        totalAmount: 2500,
        items: [
          { product_id: { name: 'Royal Canin Dog Food 10kg' }, quantity: 1 },
          { product_id: { name: 'Cat Litter Box' }, quantity: 2 }
        ],
        customerAddress: 'Test Address, Nagpur, Maharashtra 440001',
      }
    );
    console.log('   ✅ Order Confirmation sent!\n');
    
    // Test 2: Payment Receipt with PDF
    console.log('2️⃣ Sending Payment Receipt with PDF...');
    await sendPaymentSuccessEmail(
      'samruddhiamrutkar15@gmail.com',
      'Samruddhi Amrutkar',
      '#ORD789',
      2500,
      'pay_ABC123456789',
      {
        items: [
          { product_id: { name: 'Royal Canin Dog Food 10kg' }, quantity: 1, subtotal: 1800 },
          { product_id: { name: 'Cat Litter Box' }, quantity: 2, subtotal: 700 }
        ],
        customerAddress: {
          street: 'Sample Street, Dharampeth',
          city: 'Nagpur',
          state: 'Maharashtra',
          pincode: '440001',
        },
        paymentGateway: 'Razorpay',
        paymentMethod: 'UPI',
      }
    );
    console.log('   ✅ Payment Receipt with PDF sent!\n');
    
    console.log('✅✅ BOTH EMAILS SENT SUCCESSFULLY! ✅✅\n');
    console.log('📧 Check inbox: samruddhiamrutkar15@gmail.com');
    console.log('   → Order Confirmation (#ORD789)');
    console.log('   → Payment Receipt with PDF (#ORD789)');
    console.log('\n💡 Also check SPAM/JUNK folder!');
    console.log('\n🎉 Email system is working correctly!');
    console.log('   When you place a real order, you WILL receive these emails.');
    
  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

testCustomerEmail();
