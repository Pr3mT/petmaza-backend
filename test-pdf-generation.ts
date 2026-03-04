import { generatePaymentReceiptPDF } from './src/services/pdfGenerator';
import fs from 'fs';

async function testPDFGeneration() {
  console.log('🧪 Testing PDF Generation...\n');

  try {
    const pdfBuffer = await generatePaymentReceiptPDF({
      orderId: '#512f1a21',
      customerName: 'Samruddhi Amrutkar',
      customerEmail: 'samrudhiamrutkar15@gmail.com',
      transactionId: 'pay_test_1234567890',
      transactionDate: new Date().toLocaleString('en-IN', {
        dateStyle: 'full',
        timeStyle: 'short',
      }),
      amount: 540.0,
      paymentGateway: 'Razorpay',
      paymentMethod: 'Online Payment',
      items: [
        {
          product_id: { name: 'Premium Dog Food 10kg' },
          quantity: 2,
          subtotal: 400.0,
        },
        {
          product_id: { name: 'Cat Litter Box' },
          quantity: 1,
          subtotal: 140.0,
        },
      ],
      customerAddress: {
        street: '123 Pet Street, Andheri West',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400702',
      },
    });

    // Save PDF to file for testing
    fs.writeFileSync('test-payment-receipt.pdf', pdfBuffer);

    console.log('✅ PDF generated successfully!');
    console.log(`📄 Saved as: test-payment-receipt.pdf`);
    console.log(`📦 Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    console.log('\n💡 Open test-payment-receipt.pdf to view the receipt');
  } catch (error: any) {
    console.error('❌ PDF generation failed:', error.message);
    console.error(error.stack);
  }
}

testPDFGeneration();
