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

export async function generateDnaResultCertificatePdf(
  data: DnaResultCertificateData,
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      // A5 landscape: 595 wide x 420 tall
      const PW = 595;
      const PH = 420;
      const NAVY   = '#1a1a2e';
      const GOLD_C = '#f5a623';

      const resultColor = data.dnaResult === 'female' ? '#c0185d' : data.dnaResult === 'male' ? '#1d4ed8' : '#374151';
      const resultLabel = data.dnaResult === 'female' ? 'FEMALE' : data.dnaResult === 'male' ? 'MALE' : 'INCONCLUSIVE';
      const resultGender = data.dnaResult === 'female' ? '(F)' : data.dnaResult === 'male' ? '(M)' : '';

      // Generate QR code
      const qrBuffer: Buffer = await QRCode.toBuffer(data.verificationUrl, {
        errorCorrectionLevel: 'M',
        width: 120,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });

      const doc = new PDFDocument({ size: [PW, PH], margin: 0, autoFirstPage: true });
      const buffers: Buffer[] = [];
      const pass = new PassThrough();
      pass.on('data', (c: Buffer) => buffers.push(c));
      pass.on('end', () => resolve(Buffer.concat(buffers)));
      pass.on('error', reject);
      doc.pipe(pass);

      // â”€â”€ White background â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      doc.rect(0, 0, PW, PH).fill('#ffffff');

      // â”€â”€ Top header bar (navy) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const HDR = 58;
      doc.rect(0, 0, PW, HDR).fill(NAVY);

      // Gold diagonal stripe (top-left accent)
      doc.save();
      doc.moveTo(0, 0).lineTo(60, 0).lineTo(90, HDR).lineTo(0, HDR).fill(GOLD_C);
      doc.moveTo(68, 0).lineTo(110, 0).lineTo(140, HDR).lineTo(98, HDR).fill('#ffffff');
      doc.restore();

      // Header title
      doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold')
        .text('PETMAZA DNA LABS', 150, 10, { width: 280 });
      doc.fontSize(12).fillColor(GOLD_C).font('Helvetica-Bold')
        .text('DNA SEXING', 150, 36, { width: 180 });

      // QR code top-right (in header)
      const qrX = PW - 118;
      const qrY = HDR + 12;
      doc.rect(qrX - 4, qrY - 4, 112, 112).fill('#f0f0f0');
      doc.image(qrBuffer, qrX, qrY, { width: 104, height: 104 });
      doc.fontSize(6.5).fillColor('#666666').font('Helvetica')
        .text('Scan to verify', qrX - 4, qrY + 107, { width: 112, align: 'center' });

      // â”€â”€ Content area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const CX = 18;  // content left margin
      const CW = PW - 140; // content width (excluding QR area)

      // Left column labels and values
      const col1L = CX;
      const col1V = CX + 120;
      const col2L = CX + 250;
      const col2V = CX + 370;

      let ry = HDR + 18;
      const rowH = 26;

      const rows: [string, string, string, string][] = [
        ['Bird Id / Band:', data.bandId || 'N/A',     'Report Date:', fmt(data.testDate)],
        ['Farm Name:',      data.farm || 'N/A',       'Cert Id:',     certNumber(data.requestId, data.birdIndex)],
        ['Submitted by:',   data.customerName || 'N/A', '', ''],
        ['Bird Species:',   data.species || 'N/A',    '', ''],
        ['Specimen Submitted:', 'Feather / Blood',    '', ''],
      ];

      rows.forEach(([l1, v1, l2, v2]) => {
        doc.fontSize(9.5).fillColor('#444444').font('Helvetica-Bold').text(l1, col1L, ry, { width: 115 });
        doc.fontSize(9.5).fillColor('#111111').font('Helvetica').text(v1, col1V, ry, { width: 120 });
        if (l2) {
          doc.fontSize(9.5).fillColor('#444444').font('Helvetica-Bold').text(l2, col2L, ry, { width: 100 });
          doc.fontSize(9.5).fillColor('#111111').font('Helvetica').text(v2, col2V, ry, { width: 120 });
        }
        ry += rowH;
      });

      // â”€â”€ Report result â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const repY = HDR + 170;
      doc.fontSize(28).fillColor(resultColor).font('Helvetica-Bold')
        .text(`Report : ${resultLabel} ${resultGender}`, CX, repY, { width: CW - 20 });

      // â”€â”€ Bottom navy band â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const FTR = 42;
      const footerY = PH - FTR;
      doc.rect(0, footerY, PW, FTR).fill(NAVY);

      // Gold/white diagonal accents on bottom-left
      doc.save();
      doc.moveTo(0, footerY).lineTo(50, footerY).lineTo(80, PH).lineTo(0, PH).fill(GOLD_C);
      doc.moveTo(58, footerY).lineTo(100, footerY).lineTo(130, PH).lineTo(88, PH).fill('#ffffff');
      doc.restore();

      // Gold/white diagonal accents on bottom-right
      doc.save();
      doc.moveTo(PW - 50, footerY).lineTo(PW, footerY).lineTo(PW, PH).lineTo(PW - 80, PH).fill(GOLD_C);
      doc.moveTo(PW - 100, footerY).lineTo(PW - 58, footerY).lineTo(PW - 88, PH).lineTo(PW - 130, PH).fill('#ffffff');
      doc.restore();

      // Footer address text
      doc.fontSize(8).fillColor('#cccccc').font('Helvetica')
        .text('Petmaza DNA Labs, Viman Nagar, Pune, Maharashtra, India.  |  lab@petmaza.com  |  www.petmaza.com',
          100, footerY + 13, { width: PW - 200, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
