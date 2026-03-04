import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { sendOrderConfirmationEmail, sendPaymentSuccessEmail } from './src/services/emailer';

dotenv.config();

async function testCompleteEmailFlow() {
  try {
    console.log('🧪 Testing Complete Email Flow...\n');
    
    // Test 1: Order Confirmation Email
    console.log('📧 Test 1: Sending Order Confirmation Email...');
    console.log('   To: premst2100@gmail.com (your admin email)');
    
    try {
      await sendOrderConfirmationEmail(
        'premst2100@gmail.com',
        'Test Customer',
        '#TEST123',
        {
          totalAmount: 1250,
          items: [
            {
              product_id: { name: 'Dog Food Premium 5kg' },
              quantity: 2,
            },
            {
              product_id: { name: 'Cat Toy Mouse' },
              quantity: 1,
            }
          ],
          customerAddress: 'Test Address, Nagpur, Maharashtra 400001',
        }
      );
      console.log('   ✅ Order Confirmation Email sent successfully!\n');
    } catch (error: any) {
      console.error('   ❌ Failed:', error.message);
      console.error('   Stack:', error.stack);
      throw error;
    }

    // Test 2: Payment Receipt Email
    console.log('📧 Test 2: Sending Payment Receipt Email...');
    console.log('   To: premst2100@gmail.com (your admin email)');
    
    try {
      await sendPaymentSuccessEmail(
        'premst2100@gmail.com',
        'Test Customer',
        '#TEST456',
        1250,
        'pay_test123456789',
        {
          items: [
            {
              product_id: { name: 'Dog Food Premium 5kg' },
              quantity: 2,
              subtotal: 1000,
            },
            {
              product_id: { name: 'Cat Toy Mouse' },
              quantity: 1,
              subtotal: 250,
            }
          ],
          customerAddress: {
            street: 'Test Street, Dharampeth',
            city: 'Nagpur',
            state: 'Maharashtra',
            pincode: '440001',
          },
          paymentGateway: 'Razorpay',
          paymentMethod: 'Online Payment',
        }
      );
      console.log('   ✅ Payment Receipt Email sent successfully!\n');
    } catch (error: any) {
      console.error('   ❌ Failed:', error.message);
      console.error('   Stack:', error.stack);
      throw error;
    }

    console.log('\n✅✅ ALL EMAIL TESTS PASSED! ✅✅');
    console.log('\n📬 Check inbox: premst2100@gmail.com');
    console.log('   Also check SPAM folder!');
    console.log('\n💡 If you received both emails:');
    console.log('   → Email system is working correctly');
    console.log('   → Problem is with order creation flow');
    console.log('\n💡 If you did NOT receive emails:');
    console.log('   → Check Gmail account settings');
    console.log('   → Verify App Password is still valid');
    console.log('   → Check if SMTP is blocked by firewall');
    
  } catch (error: any) {
    console.error('\n❌ EMAIL TEST FAILED!');
    console.error('Error:', error.message);
    
    if (error.code === 'EAUTH') {
      console.error('\n🔒 AUTHENTICATION ERROR:');
      console.error('   → Gmail App Password is invalid or expired');
      console.error('   → Generate new App Password in Google Account settings');
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      console.error('\n🌐 CONNECTION ERROR:');
      console.error('   → Check internet connection');
      console.error('   → Firewall may be blocking port 587');
    }
  } finally {
    process.exit(0);
  }
}

testCompleteEmailFlow();
