import { sendOrderConfirmationEmail } from './src/services/emailer';

async function testNewEmailConfig() {
  try {
    console.log('🧪 Testing New Email Configuration\n');
    console.log('📧 Sending from: PETMAZA <officialpetmaza@gmail.com>');
    console.log('📧 Sending to: samruddhiamrutkar15@gmail.com\n');
    
    await sendOrderConfirmationEmail(
      'samruddhiamrutkar15@gmail.com',
      'Samruddhi Amrutkar',
      '#TEST999',
      {
        totalAmount: 1500,
        items: [
          { product_id: { name: 'Dog Food 5kg' }, quantity: 1 }
        ],
        customerAddress: 'Test Address, Nagpur 440001',
      }
    );
    
    console.log('✅ Email sent successfully!\n');
    console.log('📬 Check inbox: samruddhiamrutkar15@gmail.com');
    console.log('   From: PETMAZA <officialpetmaza@gmail.com>');
    console.log('   Subject: Order Confirmation - #TEST999\n');
    console.log('💡 Also check SPAM folder!');
    
  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    if (error.code === 'EAUTH') {
      console.error('🔒 Authentication failed - Check SMTP_PASS in .env');
    }
  } finally {
    process.exit(0);
  }
}

testNewEmailConfig();
