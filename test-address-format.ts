import { sendOrderConfirmationEmail } from './src/services/emailer';

const testOrderData = {
  items: [
    {
      product_id: { name: 'PetSafe Retractable Dog Leash 5m' },
      quantity: 1
    }
  ],
  totalAmount: 1299,
  customerAddress: {
    street: 'Uran',
    city: 'Navi Mumbai',
    state: 'Maharashtra',
    pincode: '400702'
  }
};

console.log('Testing order confirmation email with formatted address...');

sendOrderConfirmationEmail('samruddhiamrutkar15@gmail.com', 'Test Customer', 'TEST123', testOrderData)
  .then(() => {
    console.log('✅ Email sent successfully with formatted address!');
    console.log('📧 Check your inbox: samruddhiamrutkar15@gmail.com');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to send email:', error.message);
    process.exit(1);
  });
