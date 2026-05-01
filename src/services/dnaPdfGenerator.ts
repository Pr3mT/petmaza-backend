import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import QRCode from 'qrcode';

// â”€â”€â”€ Brand colours â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PRIMARY    = '#0051a5';
const GOLD       = '#e8a000';
const TEXT_DARK  = '#1a1a2e';
const TEXT_GREY  = '#555555';
const BG_LIGHT   = '#f5f8ff';
const SUCCESS    = '#16a34a';
const DANGER     = '#dc2626';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface DnaRequestPdfData {
  requestId: string;
  customerName: string;
  farm: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  birds: Array<{
    birdName?: string;
    bandId: string;
    species: string;
    collectionDateTime: Date | string;
    notes?: string;
  }>;
  totalAmount: number;
  pricePerSample: number;
  createdAt: Date | string;
  extraNote?: string;
}

export interface DnaResultCertificateData {
  requestId: string;
  birdIndex: number;
  birdName?: string;
  bandId: string;
  species: string;
  dnaResult: 'male' | 'female' | 'inconclusive';
  testDate: Date | string;
  verificationUrl: string;
  customerName: string;
  farm: string;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const fmt = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

const certNumber = (requestId: string, birdIndex: number) =>
  `PML-DNA-${requestId.slice(-8).toUpperCase()}-B${birdIndex + 1}`;

function drawHRule(doc: InstanceType<typeof PDFDocument>, color = '#dddddd', width = 1) {
  const { left, right } = doc.page.margins;
  const pageWidth = doc.page.width - left - right;
  doc
    .strokeColor(color)
    .lineWidth(width)
    .moveTo(left, doc.y)
    .lineTo(left + pageWidth, doc.y)
    .stroke()
    .moveDown(0.4);
}

function drawRow(
  doc: InstanceType<typeof PDFDocument>,
  label: string,
  value: string,
  y: number,
  lx: number,
  rx: number,
) {
  doc.fontSize(9).fillColor(TEXT_GREY).text(label, lx, y);
  doc.fontSize(9).fillColor(TEXT_DARK).text(value, rx, y);
}

// â”€â”€â”€ 1. Customer Request PDF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function generateDnaRequestPdf(data: DnaRequestPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, autoFirstPage: true });
      const buffers: Buffer[] = [];
      const pass = new PassThrough();
      pass.on('data', (c: Buffer) => buffers.push(c));
      pass.on('end', () => resolve(Buffer.concat(buffers)));
      pass.on('error', reject);
      doc.pipe(pass);

      const L = doc.page.margins.left;  // 50
      const R = doc.page.width - doc.page.margins.right; // 545
      const W = R - L;

      // â”€â”€ Header band â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      doc.rect(0, 0, doc.page.width, 90).fill(PRIMARY);
      doc.fontSize(28).fillColor('#ffffff').font('Helvetica-Bold')
        .text('PETMAZA', L, 22, { align: 'center', width: W });
      doc.fontSize(11).fillColor('#c8daff').font('Helvetica')
        .text('Bird DNA Testing â€“ Sample Submission Form', L, 58, { align: 'center', width: W });

      doc.y = 110;

      // â”€â”€ Request meta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      doc.rect(L, doc.y, W, 52).fillAndStroke(BG_LIGHT, PRIMARY);
      const metaY = doc.y + 10;
      doc.fontSize(9).fillColor(TEXT_GREY).font('Helvetica')
        .text('Request ID:', L + 12, metaY);
      doc.fontSize(9).fillColor(TEXT_DARK).font('Helvetica-Bold')
        .text(`#${data.requestId.slice(-10).toUpperCase()}`, L + 95, metaY);
      doc.fontSize(9).fillColor(TEXT_GREY).font('Helvetica')
        .text('Submitted On:', L + 12, metaY + 16);
      doc.fontSize(9).fillColor(TEXT_DARK).font('Helvetica')
        .text(fmt(data.createdAt), L + 95, metaY + 16);
      doc.fontSize(9).fillColor(TEXT_GREY).font('Helvetica')
        .text('Total Amount:', R - 180, metaY);
      doc.fontSize(11).fillColor(PRIMARY).font('Helvetica-Bold')
        .text(`â‚¹${data.totalAmount}`, R - 180, metaY + 12);
      doc.y = metaY + 62;

      doc.moveDown(0.6);

      // â”€â”€ Owner / Farm info â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      doc.fontSize(12).fillColor(PRIMARY).font('Helvetica-Bold').text('Owner & Farm Details').moveDown(0.3);
      drawHRule(doc, GOLD, 1.5);

      const lx = L + 10;
      const rx = L + 160;
      let y = doc.y;
      drawRow(doc, 'Customer Name :', data.customerName, y, lx, rx);           y += 18;
      drawRow(doc, 'Farm / Loft     :', data.farm, y, lx, rx);                  y += 18;
      drawRow(doc, 'Pickup Address  :', data.address.street, y, lx, rx);        y += 18;
      drawRow(doc, '', `${data.address.city}, ${data.address.state} â€“ ${data.address.pincode}`, y, lx, rx);
      doc.y = y + 22;

      if (data.extraNote) {
        doc.fontSize(9).fillColor(TEXT_GREY).font('Helvetica')
          .text(`Note: ${data.extraNote}`, lx, doc.y);
        doc.y += 18;
      }

      doc.moveDown(0.8);

      // â”€â”€ Birds table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      doc.fontSize(12).fillColor(PRIMARY).font('Helvetica-Bold')
        .text(`Bird Samples (${data.birds.length} bird${data.birds.length > 1 ? 's' : ''})`).moveDown(0.3);
      drawHRule(doc, GOLD, 1.5);

      // Table header
      const col = { no: L, name: L + 32, band: L + 130, species: L + 220, date: L + 340, price: L + 440 };
      const tHeaderY = doc.y;
      doc.rect(L, tHeaderY, W, 20).fill(PRIMARY);
      doc.fontSize(8.5).fillColor('#ffffff').font('Helvetica-Bold')
        .text('#',           col.no + 5,   tHeaderY + 5, { width: 28 })
        .text('Bird Name',   col.name,     tHeaderY + 5, { width: 90 })
        .text('Band ID',     col.band,     tHeaderY + 5, { width: 85 })
        .text('Species',     col.species,  tHeaderY + 5, { width: 115 })
        .text('Collection',  col.date,     tHeaderY + 5, { width: 95 })
        .text('Amount',      col.price,    tHeaderY + 5, { width: 55, align: 'right' });

      doc.y = tHeaderY + 22;

      data.birds.forEach((bird, idx) => {
        const rowY  = doc.y;
        const shade = idx % 2 === 0 ? '#fafafa' : '#ffffff';
        doc.rect(L, rowY, W, 22).fill(shade);
        doc.fontSize(8.5).fillColor(TEXT_DARK).font('Helvetica')
          .text(String(idx + 1),                                 col.no + 5,  rowY + 5, { width: 28 })
          .text(bird.birdName || `Bird ${idx + 1}`,              col.name,    rowY + 5, { width: 90 })
          .text(bird.bandId,                                      col.band,    rowY + 5, { width: 85 })
          .text(bird.species,                                     col.species, rowY + 5, { width: 115 })
          .text(fmt(bird.collectionDateTime),                     col.date,    rowY + 5, { width: 95 })
          .text(`â‚¹${data.pricePerSample}`,                       col.price,   rowY + 5, { width: 55, align: 'right' });

        if (bird.notes) {
          doc.y = rowY + 22;
          doc.rect(L, doc.y, W, 14).fill(shade);
          doc.fontSize(7.5).fillColor(TEXT_GREY).font('Helvetica-Oblique')
            .text(`  Note: ${bird.notes}`, col.name, doc.y + 2, { width: W - 35 });
          doc.y += 16;
        } else {
          doc.y = rowY + 24;
        }
      });

      // Total row
      doc.rect(L, doc.y, W, 22).fill('#e8f0fe');
      doc.fontSize(9).fillColor(TEXT_DARK).font('Helvetica-Bold')
        .text('Total Amount Payable', col.name, doc.y + 6, { width: 290 })
        .text(`â‚¹${data.totalAmount}`, col.price, doc.y + 6, { width: 55, align: 'right' });
      doc.y += 30;

      doc.moveDown(1);

      // â”€â”€ Instructions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      doc.fontSize(11).fillColor(PRIMARY).font('Helvetica-Bold').text('Instructions for Sample Submission').moveDown(0.3);
      drawHRule(doc, GOLD, 1.5);

      const steps = [
        'Print this form and place it inside the envelope along with your samples.',
        'Collect blood / feather samples separately for each bird in labelled zip bags.',
        'Write the Bird Band ID on each sample bag.',
        'Seal all samples and this form inside the envelope.',
        'Send the envelope to Petmaza Lab, Nagpur (address on website).',
        'Once received, you will be notified and the status will update to "Received".',
      ];
      steps.forEach((step, i) => {
        doc.fontSize(9).fillColor(TEXT_DARK).font('Helvetica')
          .text(`${i + 1}.  ${step}`, lx, doc.y, { width: W - 10 }).moveDown(0.35);
      });

      doc.moveDown(0.6);
      doc.rect(L, doc.y, W, 30).fill('#fff8e1');
      doc.fontSize(9).fillColor('#9a6000').font('Helvetica-Bold')
        .text('âš   Keep a copy of this form for your records. Your Request ID is required for tracking.', lx + 5, doc.y + 9, { width: W - 10 });
      doc.y += 38;

      // â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const footerY = doc.page.height - 55;
      doc.rect(0, footerY, doc.page.width, 55).fill(PRIMARY);
      doc.fontSize(8).fillColor('#c8daff').font('Helvetica')
        .text('Petmaza DNA Lab  |  lab@petmaza.com  |  www.petmaza.com', 0, footerY + 10, { align: 'center', width: doc.page.width })
        .text(`Generated on ${new Date().toLocaleDateString('en-IN')}  Â·  Request #${data.requestId.slice(-10).toUpperCase()}`, 0, footerY + 25, { align: 'center', width: doc.page.width });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// â”€â”€â”€ 2. DNA Result Certificate PDF (Landscape card style) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// --- 2. DNA Result Certificate PDF (Landscape Card - Image 2 style) -----------

export async function generateDnaResultCertificatePdf(
  data: DnaResultCertificateData,
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      // Landscape card
      const PW = 790;
      const PH = 540;

      const NAVY  = '#0d1b3e';
      const GOLD  = '#e8a000';
      const DARK  = '#111827';
      const WHITE = '#ffffff';
      const CREAM = '#fafbfd';
      const LGREY = '#6b7280';

      const resultLabel = data.dnaResult === 'male'   ? 'Male'
        : data.dnaResult === 'female' ? 'Female' : 'Inconclusive';
      const resultColor = data.dnaResult === 'male'   ? '#0044aa'
        : data.dnaResult === 'female' ? '#9d0050' : '#374151';

      // QR code
      const qrBuffer: Buffer = await QRCode.toBuffer(data.verificationUrl, {
        errorCorrectionLevel: 'H',
        width: 130,
        margin: 1,
        color: { dark: '#000000', light: WHITE },
      });

      const doc = new PDFDocument({ size: [PW, PH], margin: 0, autoFirstPage: true });
      const buffers: Buffer[] = [];
      const pass = new PassThrough();
      pass.on('data', (c: Buffer) => buffers.push(c));
      pass.on('end', () => resolve(Buffer.concat(buffers)));
      pass.on('error', reject);
      doc.pipe(pass);

      // ── Top decorative band ─────────────────────────────────────────────────
      const HDR_H = 58;
      doc.rect(0, 0, PW, HDR_H).fill(NAVY);
      // Left: gold diagonal triangle
      doc.polygon([0, 0], [100, 0], [140, HDR_H], [0, HDR_H]).fill(GOLD);
      // Left: white stripe beside it
      doc.polygon([108, 0], [140, 0], [180, HDR_H], [148, HDR_H]).fill(WHITE);
      // Right: dark inverted triangle
      doc.polygon([PW, 0], [PW - 100, 0], [PW - 140, HDR_H], [PW, HDR_H]).fill('#0a1428');
      // Right: white stripe
      doc.polygon([PW - 108, 0], [PW - 140, 0], [PW - 180, HDR_H], [PW - 148, HDR_H]).fill(WHITE);

      // ── Content area (white/cream) ──────────────────────────────────────────
      const CTY = HDR_H;
      const FTY = 470;
      doc.rect(0, CTY, PW, FTY - CTY).fill(CREAM);

      // Hex watermark in content area
      const hR = 22;
      const hH = hR * Math.sqrt(3);
      doc.save();
      doc.strokeColor('#e2e4ea').lineWidth(0.4);
      for (let row = -1; row <= Math.ceil((FTY - CTY) / hH) + 1; row++) {
        for (let col = -1; col <= Math.ceil(PW / (hR * 3)) + 1; col++) {
          const cx = col * hR * 3 + (row % 2 === 0 ? 0 : hR * 1.5);
          const cy = CTY + row * hH;
          let first = true;
          for (let i = 0; i < 6; i++) {
            const ang = (Math.PI / 3) * i - Math.PI / 6;
            const hx = cx + hR * Math.cos(ang);
            const hy = cy + hR * Math.sin(ang);
            if (first) { doc.moveTo(hx, hy); first = false; } else doc.lineTo(hx, hy);
          }
          doc.closePath();
        }
      }
      doc.stroke();
      doc.restore();

      // ── Company name ─────────────────────────────────────────────────────────
      const TY = CTY + 16;
      doc.font('Helvetica-Bold').fontSize(32).fillColor(NAVY)
        .text('PETMAZA DNA LABS', 55, TY, { continued: true, lineBreak: false });
      doc.font('Helvetica-BoldOblique').fontSize(20).fillColor(GOLD)
        .text('   DNA SEXING', { lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor(LGREY)
        .text('Certified Laboratory for Avian DNA Analysis', 55, TY + 36, { lineBreak: false });

      // ── QR code (top-right) ───────────────────────────────────────────────────
      const qrSZ = 100;
      const qrX  = PW - qrSZ - 38;
      const qrY  = CTY + 10;
      doc.rect(qrX - 6, qrY - 6, qrSZ + 12, qrSZ + 20).fill(WHITE);
      doc.rect(qrX - 6, qrY - 6, qrSZ + 12, qrSZ + 20)
        .lineWidth(0.8).strokeColor('#cccccc').stroke();
      doc.image(qrBuffer, qrX, qrY, { width: qrSZ, height: qrSZ });
      doc.font('Helvetica').fontSize(7).fillColor(LGREY)
        .text('Scan to verify', qrX - 6, qrY + qrSZ + 5, { width: qrSZ + 12, align: 'center' });

      // ── Data fields ──────────────────────────────────────────────────────────
      const FS  = 11.5;
      const GAP = 26;
      const LX  = 55;
      const RX  = 430;
      const FSY = TY + 58;

      const leftFields: [string, string][] = [
        ['Bird Id/ Band:',  data.bandId       || 'N/A'],
        ['Farm Name:',      data.farm         || 'N/A'],
        ['Submitted by:',   data.customerName || 'N/A'],
        ['Bird Species:',   data.species      || 'N/A'],
        ['Specimen:',       'Feather / Blood'],
      ];
      const rightFields: [string, string][] = [
        ['Report Date:',  fmt(data.testDate)],
        ['Cert Id:',      certNumber(data.requestId, data.birdIndex)],
      ];

      leftFields.forEach(([lbl, val], i) => {
        doc.font('Helvetica-BoldOblique').fontSize(FS).fillColor('#4b5563')
          .text(lbl + '  ', LX, FSY + i * GAP, { continued: true, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(FS).fillColor(DARK)
          .text(val, { lineBreak: false });
      });
      rightFields.forEach(([lbl, val], i) => {
        doc.font('Helvetica-BoldOblique').fontSize(FS).fillColor('#4b5563')
          .text(lbl + '  ', RX, FSY + i * GAP, { continued: true, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(FS).fillColor(DARK)
          .text(val, { lineBreak: false });
      });

      // ── Gold divider ─────────────────────────────────────────────────────────
      const DIV_Y = FSY + leftFields.length * GAP + 10;
      doc.save();
      doc.moveTo(40, DIV_Y).lineTo(PW - 40, DIV_Y).lineWidth(2).strokeColor(GOLD).stroke();
      doc.restore();

      // ── Result section ────────────────────────────────────────────────────────
      const RSY = DIV_Y + 16;
      const RSH = FTY - RSY - 10;

      // Left: result badge circle
      const badgeCX = 90;
      const badgeCY = RSY + RSH / 2;
      const badgeR  = 52;
      doc.circle(badgeCX, badgeCY, badgeR).fill(WHITE);
      doc.circle(badgeCX, badgeCY, badgeR).lineWidth(2.5).strokeColor(GOLD).stroke();
      doc.circle(badgeCX, badgeCY, badgeR - 5).lineWidth(0.8).strokeColor(GOLD).stroke();
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#888888')
        .text('RESULT', badgeCX - 30, badgeCY - 28, { width: 60, align: 'center', lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(22).fillColor(resultColor)
        .text(resultLabel, badgeCX - 32, badgeCY - 12, { width: 64, align: 'center', lineBreak: false });
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#aaaaaa')
        .text('Certified', badgeCX - 28, badgeCY + 14, { width: 56, align: 'center', lineBreak: false });

      // Center: Report text
      const reptX = badgeCX + badgeR + 28;
      const reptW = qrX - reptX - 24;
      doc.font('Helvetica-BoldOblique').fontSize(36).fillColor(resultColor)
        .text(`Report : ${resultLabel}`, reptX, RSY + (RSH - 44) / 2, { width: reptW, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor('#888888')
        .text('Certified by Petmaza DNA Labs', reptX, RSY + (RSH - 44) / 2 + 46, { width: reptW, lineBreak: false });

      // Right of result: signature block
      const sigX = qrX - 160;
      const sigY2 = FTY - 52;
      doc.save();
      doc.moveTo(sigX, sigY2).lineTo(sigX + 140, sigY2).lineWidth(0.7).strokeColor('#bbbbbb').stroke();
      doc.restore();
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#444444')
        .text('Authorised Signatory', sigX, sigY2 + 4, { width: 140, lineBreak: false });
      doc.font('Helvetica').fontSize(7.5).fillColor('#888888')
        .text('Lab Director, Petmaza DNA Labs', sigX, sigY2 + 16, { width: 140, lineBreak: false });

      // ── Footer band ──────────────────────────────────────────────────────────
      doc.rect(0, FTY, PW, PH - FTY).fill(NAVY);
      // Left diagonals
      doc.polygon([0, FTY], [95, FTY], [135, PH], [0, PH]).fill(GOLD);
      doc.polygon([103, FTY], [135, FTY], [175, PH], [143, PH]).fill(WHITE);
      // Right diagonals
      doc.polygon([PW, FTY], [PW - 95, FTY], [PW - 135, PH], [PW, PH]).fill('#0a1428');
      doc.polygon([PW - 103, FTY], [PW - 135, FTY], [PW - 175, PH], [PW - 143, PH]).fill(WHITE);
      // Address text
      doc.font('Helvetica').fontSize(9.5).fillColor(WHITE)
        .text(
          'Panvel, Maharashtra, India  |  lab@petmaza.com  |  www.petmaza.com',
          0, FTY + 18, { width: PW, align: 'center' },
        );
      doc.font('Helvetica').fontSize(8).fillColor(GOLD)
        .text(
          `Generated: ${new Date().toLocaleDateString('en-IN')}  \u00B7  Cert #${certNumber(data.requestId, data.birdIndex)}`,
          0, FTY + 32, { width: PW, align: 'center' },
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
