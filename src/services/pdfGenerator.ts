import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import * as fs from 'fs';
import * as path from 'path';

// ─── Brand palette (kept in sync with dnaPdfGenerator.ts) ─────────────────────
const PRIMARY   = '#0051a5';
const PRIMARY_SOFT = '#c8daff';
const GOLD      = '#e8a000';
const TEXT_DARK = '#1a1a2e';
const TEXT_GREY = '#555555';
const BG_LIGHT  = '#f5f8ff';
const SUCCESS   = '#16a34a';
const SUCCESS_BG = '#e9f7ef';

// PDFKit's built-in fonts are WinAnsi-encoded and cannot render '₹', so all
// amounts use "Rs." with Indian digit grouping instead.
const inr = (n: number): string => {
  const [int, dec] = (Number(n) || 0).toFixed(2).split('.');
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return `Rs. ${grouped}.${dec}`;
};

// Load the PetMaza logo once at module load (same candidates as the DNA PDFs)
const LOGO_BUFFER: Buffer | null = (() => {
  const candidates = [
    path.resolve(__dirname, '../../public/petmaza-logo.jpeg'),
    path.resolve(process.cwd(), 'public/petmaza-logo.jpeg'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p);
    } catch {
      /* fall through to next candidate */
    }
  }
  return null;
})();

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
 * Generate payment receipt PDF (attached to the payment-success email)
 */
export async function generatePaymentReceiptPDF(data: PaymentReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, autoFirstPage: true });

      const buffers: Buffer[] = [];
      const stream = new PassThrough();
      stream.on('data', (chunk) => buffers.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(buffers)));
      stream.on('error', reject);
      doc.pipe(stream);

      const L = doc.page.margins.left;                    // 50
      const R = doc.page.width - doc.page.margins.right;  // 545
      const W = R - L;
      const FOOTER_H = 58;
      const BOTTOM = doc.page.height - FOOTER_H - 20;     // content must stay above this

      // Adds a page when `needed` points of vertical space aren't available.
      const ensureSpace = (needed: number) => {
        if (doc.y + needed > BOTTOM) {
          doc.addPage();
          doc.y = doc.page.margins.top;
        }
      };

      const sectionTitle = (title: string) => {
        ensureSpace(40);
        doc.fontSize(11).fillColor(PRIMARY).font('Helvetica-Bold').text(title, L, doc.y);
        doc.moveDown(0.25);
        doc.strokeColor(GOLD).lineWidth(1.2)
          .moveTo(L, doc.y).lineTo(R, doc.y).stroke();
        doc.moveDown(0.5);
      };

      // ── Header band ──────────────────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 92).fill(PRIMARY);
      doc.rect(0, 88, doc.page.width, 4).fill(GOLD);

      if (LOGO_BUFFER) {
        const r = 28;
        const cx = L + r;
        const cy = 44;
        doc.circle(cx, cy, r + 2).fill(GOLD);
        doc.save();
        doc.circle(cx, cy, r).clip();
        doc.image(LOGO_BUFFER, cx - r, cy - r, { width: r * 2, height: r * 2 });
        doc.restore();
      }

      doc.fontSize(26).fillColor('#ffffff').font('Helvetica-Bold')
        .text('PETMAZA', L, 26, { align: 'center', width: W });
      doc.fontSize(11).fillColor(PRIMARY_SOFT).font('Helvetica')
        .text('Payment Receipt', L, 58, { align: 'center', width: W });

      doc.y = 112;

      // ── Success banner with amount ───────────────────────────────────────────
      const bannerY = doc.y;
      doc.roundedRect(L, bannerY, W, 44, 4).fill(SUCCESS_BG);
      // vector check badge (built-in fonts can't render ✓/emoji)
      const ccx = L + 24;
      const ccy = bannerY + 22;
      doc.circle(ccx, ccy, 11).fill(SUCCESS);
      doc.moveTo(ccx - 5, ccy)
        .lineTo(ccx - 1.5, ccy + 4)
        .lineTo(ccx + 5.5, ccy - 4)
        .lineWidth(2.2).strokeColor('#ffffff').stroke();
      doc.fontSize(13).fillColor(SUCCESS).font('Helvetica-Bold')
        .text('Payment Successful', ccx + 22, bannerY + 9);
      doc.fontSize(8.5).fillColor(TEXT_GREY).font('Helvetica')
        .text(data.transactionDate, ccx + 22, bannerY + 26);
      doc.fontSize(16).fillColor(SUCCESS).font('Helvetica-Bold')
        .text(inr(data.amount), L, bannerY + 14, { width: W - 16, align: 'right' });
      doc.y = bannerY + 60;

      // ── Transaction details box ──────────────────────────────────────────────
      const metaRows: Array<[string, string, string?]> = [
        ['Order ID', `#${data.orderId}`],
        ['Transaction ID', data.transactionId],
        ['Payment Method', `${data.paymentGateway} – ${data.paymentMethod}`],
        ['Payment Status', 'PAID', SUCCESS],
      ];
      const metaH = metaRows.length * 18 + 16;
      const metaY = doc.y;
      doc.roundedRect(L, metaY, W, metaH, 4).fillAndStroke(BG_LIGHT, PRIMARY);
      metaRows.forEach(([label, value, color], i) => {
        const rowY = metaY + 10 + i * 18;
        doc.fontSize(9).fillColor(TEXT_GREY).font('Helvetica').text(label, L + 14, rowY);
        doc.fontSize(9).fillColor(color || TEXT_DARK).font('Helvetica-Bold')
          .text(value, L + 130, rowY, { width: W - 144 });
      });
      doc.y = metaY + metaH + 22;

      // ── Items table ──────────────────────────────────────────────────────────
      if (data.items && data.items.length > 0) {
        sectionTitle('Order Summary');

        const col = { name: L, qty: R - 150, amount: R - 90 };
        const drawTableHeader = () => {
          const hY = doc.y;
          doc.rect(L, hY, W, 20).fill(PRIMARY);
          doc.fontSize(8.5).fillColor('#ffffff').font('Helvetica-Bold')
            .text('Product', col.name + 10, hY + 6, { width: col.qty - col.name - 20 })
            .text('Qty', col.qty, hY + 6, { width: 40, align: 'center' })
            .text('Amount', col.amount, hY + 6, { width: 90, align: 'right' });
          doc.y = hY + 22;
        };
        drawTableHeader();

        data.items.forEach((item, idx) => {
          if (doc.y + 24 > BOTTOM) {
            doc.addPage();
            doc.y = doc.page.margins.top;
            drawTableHeader();
          }
          const rowY = doc.y;
          doc.rect(L, rowY, W, 22).fill(idx % 2 === 0 ? '#fafafa' : '#ffffff');
          doc.fontSize(8.5).fillColor(TEXT_DARK).font('Helvetica')
            .text(item.product_id?.name || 'Product', col.name + 10, rowY + 6, {
              width: col.qty - col.name - 20, ellipsis: true, lineBreak: false,
            })
            .text(String(item.quantity), col.qty, rowY + 6, { width: 40, align: 'center' })
            .text(inr(item.subtotal), col.amount, rowY + 6, { width: 90, align: 'right' });
          doc.y = rowY + 22;
        });

        // Total row
        ensureSpace(30);
        const tY = doc.y;
        doc.rect(L, tY, W, 24).fill('#e8f0fe');
        doc.fontSize(9.5).fillColor(TEXT_DARK).font('Helvetica-Bold')
          .text('Total Paid', col.name + 10, tY + 7)
          .fillColor(SUCCESS)
          .text(inr(data.amount), col.amount, tY + 7, { width: 90, align: 'right' });
        doc.y = tY + 40;
      }

      // ── Customer & delivery details (two columns) ────────────────────────────
      ensureSpace(110);
      sectionTitle('Customer & Delivery Details');

      const colY = doc.y;
      const halfW = W / 2 - 10;

      doc.fontSize(8.5).fillColor(TEXT_GREY).font('Helvetica-Bold')
        .text('BILLED TO', L, colY, { characterSpacing: 1 });
      doc.fontSize(9.5).fillColor(TEXT_DARK).font('Helvetica-Bold')
        .text(data.customerName, L, colY + 14, { width: halfW });
      doc.fontSize(9).fillColor(TEXT_GREY).font('Helvetica')
        .text(data.customerEmail, L, doc.y + 2, { width: halfW });

      if (data.customerAddress) {
        const a = data.customerAddress;
        const addrX = L + W / 2 + 10;
        doc.fontSize(8.5).fillColor(TEXT_GREY).font('Helvetica-Bold')
          .text('DELIVERY ADDRESS', addrX, colY, { characterSpacing: 1 });
        const addrLines = [
          a.street,
          [a.city, a.state].filter(Boolean).join(', '),
          a.pincode ? `Pincode: ${a.pincode}` : '',
        ].filter(Boolean) as string[];
        doc.fontSize(9).fillColor(TEXT_DARK).font('Helvetica')
          .text(addrLines.join('\n'), addrX, colY + 14, { width: halfW, lineGap: 2 });
      }
      doc.y = colY + 78;

      // ── Note strip ───────────────────────────────────────────────────────────
      ensureSpace(40);
      const noteY = doc.y;
      doc.roundedRect(L, noteY, W, 28, 4).fill('#fff8e1');
      doc.fontSize(8.5).fillColor('#9a6000').font('Helvetica')
        .text(
          'This is a computer-generated receipt and does not require a signature. Please retain it for your records.',
          L + 12, noteY + 9, { width: W - 24 },
        );

      // ── Footer band (last page only) ─────────────────────────────────────────
      // Zero the bottom margin first: PDFKit auto-adds a page for any text
      // rendered below it, which would push the footer text onto blank pages.
      doc.page.margins.bottom = 0;
      const footerY = doc.page.height - FOOTER_H;
      doc.rect(0, footerY, doc.page.width, FOOTER_H).fill(PRIMARY);
      doc.rect(0, footerY, doc.page.width, 3).fill(GOLD);
      doc.fontSize(8.5).fillColor('#ffffff').font('Helvetica-Bold')
        .text('support@petmaza.com   |   www.petmaza.com   |   +91 70212 10753',
          0, footerY + 16, { align: 'center', width: doc.page.width });
      doc.fontSize(7.5).fillColor(PRIMARY_SOFT).font('Helvetica')
        .text(`© ${new Date().getFullYear()} Petmaza. All rights reserved.`,
          0, footerY + 32, { align: 'center', width: doc.page.width });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
