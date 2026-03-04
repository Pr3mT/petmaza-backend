import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

interface PaymentReceiptData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  transactionId: string;
  transactionDate: string;
  amount: number;
  paymentGateway: string;
  paymentMethod: string;
  items?: Array<{
    product_id?: { name?: string };
    quantity: number;
    subtotal: number;
  }>;
  customerAddress?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
}

/**
 * Generate payment receipt PDF
 */
export async function generatePaymentReceiptPDF(data: PaymentReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
      });

      const buffers: Buffer[] = [];
      const stream = new PassThrough();

      stream.on('data', (chunk) => buffers.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(buffers)));
      stream.on('error', reject);

      doc.pipe(stream);

      // Header - Company Logo/Name
      doc
        .fontSize(28)
        .fillColor('#FFD700')
        .text('🐾 PETMAZA', { align: 'center' })
        .fontSize(12)
        .fillColor('#666666')
        .text('Payment Receipt', { align: 'center' })
        .moveDown(2);

      // Success Badge
      doc
        .fontSize(18)
        .fillColor('#2e7d32')
        .text('✓ PAYMENT SUCCESSFUL', { align: 'center' })
        .moveDown(1);

      // Draw horizontal line
      doc
        .strokeColor('#FFD700')
        .lineWidth(2)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(1);

      // Payment Details Section
      doc
        .fontSize(14)
        .fillColor('#333333')
        .text('Payment Receipt', { underline: true })
        .moveDown(0.5);

      const leftColumn = 80;
      const rightColumn = 250;
      let yPosition = doc.y;

      // Order ID
      doc
        .fontSize(10)
        .fillColor('#666666')
        .text('Order ID:', leftColumn, yPosition);
      doc
        .fontSize(10)
        .fillColor('#000000')
        .text(data.orderId, rightColumn, yPosition);
      yPosition += 20;

      // Transaction ID
      doc
        .fontSize(10)
        .fillColor('#666666')
        .text('Transaction ID:', leftColumn, yPosition);
      doc
        .fontSize(8)
        .fillColor('#000000')
        .text(data.transactionId, rightColumn, yPosition);
      yPosition += 20;

      // Payment Gateway
      doc
        .fontSize(10)
        .fillColor('#666666')
        .text('Payment Gateway:', leftColumn, yPosition);
      doc
        .fontSize(10)
        .fillColor('#000000')
        .text(`${data.paymentGateway} - ${data.paymentMethod}`, rightColumn, yPosition);
      yPosition += 20;

      // Transaction Date
      doc
        .fontSize(10)
        .fillColor('#666666')
        .text('Transaction Date:', leftColumn, yPosition);
      doc
        .fontSize(10)
        .fillColor('#000000')
        .text(data.transactionDate, rightColumn, yPosition);
      yPosition += 20;

      // Payment Status
      doc
        .fontSize(10)
        .fillColor('#666666')
        .text('Payment Status:', leftColumn, yPosition);
      doc
        .fontSize(10)
        .fillColor('#2e7d32')
        .text('PAID', rightColumn, yPosition);
      yPosition += 30;

      // Amount Paid (Prominent)
      doc
        .fontSize(12)
        .fillColor('#666666')
        .text('Amount Paid:', leftColumn, yPosition);
      doc
        .fontSize(20)
        .fillColor('#2e7d32')
        .text(`₹${data.amount.toFixed(2)}`, rightColumn, yPosition - 5);
      yPosition += 40;

      // Draw separator line
      doc
        .strokeColor('#cccccc')
        .lineWidth(1)
        .moveTo(70, yPosition)
        .lineTo(525, yPosition)
        .stroke();
      yPosition += 20;

      // Items Ordered Section
      if (data.items && data.items.length > 0) {
        doc
          .fontSize(12)
          .fillColor('#333333')
          .text('Items Ordered', 70, yPosition, { underline: true });
        yPosition += 25;

        // Table Headers
        doc
          .fontSize(9)
          .fillColor('#666666')
          .text('Product', 70, yPosition)
          .text('Qty', 380, yPosition)
          .text('Price', 470, yPosition);
        yPosition += 15;

        // Draw line under headers
        doc
          .strokeColor('#eeeeee')
          .lineWidth(1)
          .moveTo(70, yPosition)
          .lineTo(525, yPosition)
          .stroke();
        yPosition += 10;

        // Items
        data.items.forEach((item) => {
          doc
            .fontSize(9)
            .fillColor('#000000')
            .text(item.product_id?.name || 'Product', 70, yPosition, { width: 300 })
            .text(item.quantity.toString(), 380, yPosition)
            .text(`₹${item.subtotal.toFixed(2)}`, 470, yPosition);
          yPosition += 20;
        });

        // Draw line before total
        yPosition += 5;
        doc
          .strokeColor('#cccccc')
          .lineWidth(1)
          .moveTo(70, yPosition)
          .lineTo(525, yPosition)
          .stroke();
        yPosition += 15;

        // Total
        doc
          .fontSize(11)
          .fillColor('#000000')
          .text('Total:', 380, yPosition)
          .fontSize(12)
          .fillColor('#2e7d32')
          .text(`₹${data.amount.toFixed(2)}`, 470, yPosition);
        yPosition += 30;
      }

      // Delivery Address Section
      if (data.customerAddress) {
        doc
          .fontSize(12)
          .fillColor('#333333')
          .text('Delivery Address', 70, yPosition, { underline: true });
        yPosition += 20;

        doc
          .fontSize(9)
          .fillColor('#000000')
          .text(data.customerAddress.street || '', 80, yPosition)
          .text(
            `${data.customerAddress.city || ''}, ${data.customerAddress.state || ''}`,
            80,
            yPosition + 15
          )
          .text(`Pincode: ${data.customerAddress.pincode || ''}`, 80, yPosition + 30);
        yPosition += 55;
      }

      // Customer Details
      doc
        .fontSize(12)
        .fillColor('#333333')
        .text('Customer Details', 70, yPosition, { underline: true });
      yPosition += 20;

      doc
        .fontSize(9)
        .fillColor('#000000')
        .text(`Name: ${data.customerName}`, 80, yPosition)
        .text(`Email: ${data.customerEmail}`, 80, yPosition + 15);
      yPosition += 45;

      // Footer with important note
      doc
        .fontSize(8)
        .fillColor('#856404')
        .text(
          '📄 This is a computer-generated receipt and does not require a signature.',
          70,
          yPosition,
          { width: 455, align: 'center' }
        );
      yPosition += 25;

      doc
        .fontSize(8)
        .fillColor('#666666')
        .text('For any queries, contact: support@petmaza.com', { align: 'center' })
        .moveDown(1);

      doc
        .fontSize(7)
        .fillColor('#999999')
        .text(`© ${new Date().getFullYear()} Petmaza. All rights reserved.`, { align: 'center' });

      // Finalize PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
