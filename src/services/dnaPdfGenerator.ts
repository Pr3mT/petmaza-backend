import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';

// --- Load PetMaza logo — PDFKit handles JPEG/PNG natively, no sharp needed ---
function loadLogoBuffer(_sizePx: number): Buffer | null {
  const candidates = [
    path.resolve(__dirname, '../../../petmaza-frontend/public/pets/petmaza.jpeg'),
    path.resolve(__dirname, '../../../petmaza-frontend/public/logo512.png'),
    path.resolve(__dirname, '../../../petmaza-frontend/public/logo192.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        return fs.readFileSync(p);
      } catch { /* fall through */ }
    }
  }
  return null;
}

// ─── Brand colours ────────────────────────────────────────────────────────────
const PRIMARY    = '#0051a5';
const GOLD       = '#e8a000';
const TEXT_DARK  = '#1a1a2e';
const TEXT_GREY  = '#555555';
const BG_LIGHT   = '#f5f8ff';
const SUCCESS    = '#16a34a';
const DANGER     = '#dc2626';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  pickupRequested?: boolean;
  printedCardRequested?: boolean;
  pickupCharge?: number;
  printedCardCharge?: number;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── 1. Customer Request PDF ──────────────────────────────────────────────────

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

      // ── Header band ──────────────────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 90).fill(PRIMARY);
      doc.fontSize(28).fillColor('#ffffff').font('Helvetica-Bold')
        .text('PETMAZA', L, 22, { align: 'center', width: W });
      doc.fontSize(11).fillColor('#c8daff').font('Helvetica')
        .text('Bird DNA Testing – Sample Submission Form', L, 58, { align: 'center', width: W });

      doc.y = 110;

      // ── Request meta ─────────────────────────────────────────────────────────
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
        .text(`Rs.${data.totalAmount}`, R - 180, metaY + 12);
      doc.y = metaY + 62;

      doc.moveDown(0.6);

      // ── Owner / Farm info ────────────────────────────────────────────────────
      doc.fontSize(12).fillColor(PRIMARY).font('Helvetica-Bold').text('Owner & Farm Details').moveDown(0.3);
      drawHRule(doc, GOLD, 1.5);

      const lx = L + 10;
      const rx = L + 160;
      let y = doc.y;
      drawRow(doc, 'Customer Name :', data.customerName, y, lx, rx);           y += 18;
      drawRow(doc, 'Farm / Loft     :', data.farm, y, lx, rx);                  y += 18;
      drawRow(doc, 'Pickup Address  :', data.address.street, y, lx, rx);        y += 18;
      drawRow(doc, '', `${data.address.city}, ${data.address.state} – ${data.address.pincode}`, y, lx, rx);
      doc.y = y + 22;

      if (data.extraNote) {
        doc.fontSize(9).fillColor(TEXT_GREY).font('Helvetica')
          .text(`Note: ${data.extraNote}`, lx, doc.y);
        doc.y += 18;
      }

      doc.moveDown(0.8);

      // ── Birds table ───────────────────────────────────────────────────────────
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
          .text(`Rs.${data.pricePerSample}`,                      col.price,   rowY + 5, { width: 55, align: 'right' });

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

      // Subtotal for birds
      const birdsSubtotal = data.birds.length * data.pricePerSample;
      doc.rect(L, doc.y, W, 20).fill('#f3f4f6');
      doc.fontSize(8.5).fillColor(TEXT_DARK).font('Helvetica')
        .text(
          `Subtotal (${data.birds.length} bird${data.birds.length > 1 ? 's' : ''} x Rs.${data.pricePerSample})`,
          col.name, doc.y + 5, { width: 290 },
        )
        .text(`Rs.${birdsSubtotal}`, col.price, doc.y + 5, { width: 55, align: 'right' });
      doc.y += 22;

      // Add-on: Doorstep pickup
      if (data.pickupRequested && (data.pickupCharge || 0) > 0) {
        doc.rect(L, doc.y, W, 20).fill('#ffffff');
        doc.fontSize(8.5).fillColor(TEXT_DARK).font('Helvetica')
          .text('Doorstep Pickup Service', col.name, doc.y + 5, { width: 290 })
          .text(`Rs.${data.pickupCharge}`, col.price, doc.y + 5, { width: 55, align: 'right' });
        doc.y += 22;
      }

      // Add-on: Printed cards (per bird)
      if (data.printedCardRequested && (data.printedCardCharge || 0) > 0) {
        const perCard = data.birds.length > 0 ? Math.round((data.printedCardCharge || 0) / data.birds.length) : 0;
        doc.rect(L, doc.y, W, 20).fill('#f3f4f6');
        doc.fontSize(8.5).fillColor(TEXT_DARK).font('Helvetica')
          .text(
            `Printed DNA Cards (${data.birds.length} x Rs.${perCard})`,
            col.name, doc.y + 5, { width: 290 },
          )
          .text(`Rs.${data.printedCardCharge}`, col.price, doc.y + 5, { width: 55, align: 'right' });
        doc.y += 22;
      }

      // Total row
      doc.rect(L, doc.y, W, 22).fill('#e8f0fe');
      doc.fontSize(9).fillColor(TEXT_DARK).font('Helvetica-Bold')
        .text('Total Amount Payable', col.name, doc.y + 6, { width: 290 })
        .text(`Rs.${data.totalAmount}`, col.price, doc.y + 6, { width: 55, align: 'right' });
      doc.y += 30;

      doc.moveDown(1);

      // ── Instructions ──────────────────────────────────────────────────────────
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
        .text('⚠  Keep a copy of this form for your records. Your Request ID is required for tracking.', lx + 5, doc.y + 9, { width: W - 10 });
      doc.y += 38;

      // ── Footer ────────────────────────────────────────────────────────────────
      const footerY = doc.page.height - 55;
      doc.rect(0, footerY, doc.page.width, 55).fill(PRIMARY);
      doc.fontSize(8).fillColor('#c8daff').font('Helvetica')
        .text('Petmaza DNA Lab  |  lab@petmaza.com  |  www.petmaza.com', 0, footerY + 10, { align: 'center', width: doc.page.width })
        .text(`Generated on ${new Date().toLocaleDateString('en-IN')}  ·  Request #${data.requestId.slice(-10).toUpperCase()}`, 0, footerY + 25, { align: 'center', width: doc.page.width });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ─── 2. DNA Result Certificate PDF (Landscape card style) ────────────────────

// --- 2. DNA Result Card PDF (designer cover + certificate card) --------------

export async function generateDnaResultCertificatePdf(
  data: DnaResultCertificateData,
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const PW = 794;
      const PH = 540;

      // -- Brand palette -----------------------------------------------------
      const NAVY      = '#0d1b3e';
      const NAVY_DEEP = '#0a1530';
      const GOLD      = '#d4a017';
      const GOLD_SOFT = '#f5d97e';
      const CREAM     = '#fbf7ef';
      const PAPER     = '#ffffff';
      const INK       = '#1f2937';
      const MUTED     = '#6b7280';

      const resultLabel = data.dnaResult === 'male'   ? 'MALE'
        : data.dnaResult === 'female' ? 'FEMALE' : 'INCONCLUSIVE';
      const resultColor = data.dnaResult === 'male'   ? '#374151'
        : data.dnaResult === 'female' ? '#374151' : '#374151';

      const qrBuffer: Buffer = await QRCode.toBuffer(data.verificationUrl, {
        errorCorrectionLevel: 'H',
        width: 130,
        margin: 1,
        color: { dark: NAVY_DEEP, light: PAPER },
      });
      const logoPng96  = loadLogoBuffer(96);
      const logoPng240 = loadLogoBuffer(240);

      const doc = new PDFDocument({ size: [PW, PH], margin: 0, autoFirstPage: true });
      const buffers: Buffer[] = [];
      const pass = new PassThrough();
      pass.on('data', (c: Buffer) => buffers.push(c));
      pass.on('end', () => resolve(Buffer.concat(buffers)));
      pass.on('error', reject);
      doc.pipe(pass);

      // ====================================================================
      //  ICON LIBRARY — simple geometric drawings, all sized by `s`
      // ====================================================================
      const drawIcon = (kind: string, cx: number, cy: number, s: number, color: string) => {
        const r = s / 2;
        doc.save();
        switch (kind) {
          case 'person': {
            doc.circle(cx, cy - r * 0.45, r * 0.38).fill(color);
            // shoulders/body arc as a rounded rect
            doc.roundedRect(cx - r * 0.65, cy - r * 0.05, r * 1.3, r * 0.8, r * 0.35).fill(color);
            break;
          }
          case 'flask': {
            // neck
            doc.rect(cx - r * 0.18, cy - r * 0.7, r * 0.36, r * 0.4).fill(color);
            // body (triangle-ish trapezoid)
            doc.polygon(
              [cx - r * 0.18, cy - r * 0.3], [cx + r * 0.18, cy - r * 0.3],
              [cx + r * 0.7,  cy + r * 0.55], [cx - r * 0.7,  cy + r * 0.55],
            ).fill(color);
            // liquid line
            doc.moveTo(cx - r * 0.55, cy + r * 0.2).lineTo(cx + r * 0.55, cy + r * 0.2)
              .lineWidth(0.8).strokeColor(PAPER).stroke();
            break;
          }
          case 'calendar': {
            doc.roundedRect(cx - r * 0.75, cy - r * 0.6, r * 1.5, r * 1.3, 2).fill(color);
            // top binding bar
            doc.rect(cx - r * 0.75, cy - r * 0.6, r * 1.5, r * 0.32).fill(NAVY_DEEP);
            // rings
            doc.rect(cx - r * 0.45, cy - r * 0.75, r * 0.15, r * 0.3).fill(color);
            doc.rect(cx + r * 0.30, cy - r * 0.75, r * 0.15, r * 0.3).fill(color);
            // dot grid
            for (let row = 0; row < 2; row++) {
              for (let col = 0; col < 3; col++) {
                doc.rect(cx - r * 0.55 + col * r * 0.4, cy + row * r * 0.3 - r * 0.1,
                         r * 0.18, r * 0.16).fill(PAPER);
              }
            }
            break;
          }
          case 'tag': {
            // rotated tag shape
            doc.polygon(
              [cx - r * 0.7, cy - r * 0.5], [cx + r * 0.3, cy - r * 0.5],
              [cx + r * 0.7, cy],            [cx + r * 0.3, cy + r * 0.5],
              [cx - r * 0.7, cy + r * 0.5],
            ).fill(color);
            // hole
            doc.circle(cx - r * 0.4, cy, r * 0.14).fill(PAPER);
            break;
          }
          case 'home': {
            // roof triangle
            doc.polygon([cx - r * 0.7, cy - r * 0.1], [cx, cy - r * 0.75], [cx + r * 0.7, cy - r * 0.1]).fill(color);
            // body
            doc.rect(cx - r * 0.55, cy - r * 0.15, r * 1.1, r * 0.75).fill(color);
            // door
            doc.rect(cx - r * 0.15, cy + r * 0.15, r * 0.3, r * 0.45).fill(PAPER);
            break;
          }
          case 'bird': {
            // body
            doc.circle(cx, cy + r * 0.05, r * 0.45).fill(color);
            // head
            doc.circle(cx + r * 0.4, cy - r * 0.3, r * 0.28).fill(color);
            // beak
            doc.polygon(
              [cx + r * 0.65, cy - r * 0.3], [cx + r * 0.9, cy - r * 0.25], [cx + r * 0.65, cy - r * 0.15],
            ).fill(GOLD);
            // tail
            doc.polygon(
              [cx - r * 0.4, cy + r * 0.05], [cx - r * 0.85, cy - r * 0.2], [cx - r * 0.7, cy + r * 0.25],
            ).fill(color);
            break;
          }
          case 'clipboard': {
            // body
            doc.roundedRect(cx - r * 0.6, cy - r * 0.55, r * 1.2, r * 1.2, 2).fill(color);
            // clip
            doc.roundedRect(cx - r * 0.3, cy - r * 0.7, r * 0.6, r * 0.25, 2).fill(NAVY_DEEP);
            // text lines
            doc.rect(cx - r * 0.4, cy - r * 0.2, r * 0.8, r * 0.08).fill(PAPER);
            doc.rect(cx - r * 0.4, cy,           r * 0.6, r * 0.08).fill(PAPER);
            doc.rect(cx - r * 0.4, cy + r * 0.2, r * 0.7, r * 0.08).fill(PAPER);
            break;
          }
          case 'drop': {
            // water droplet
            doc.polygon([cx, cy - r * 0.7], [cx + r * 0.55, cy + r * 0.3], [cx - r * 0.55, cy + r * 0.3]).fill(color);
            doc.circle(cx, cy + r * 0.25, r * 0.5).fill(color);
            break;
          }
          case 'shield': {
            doc.polygon(
              [cx - r * 0.6, cy - r * 0.55], [cx + r * 0.6, cy - r * 0.55],
              [cx + r * 0.6, cy + r * 0.1],
              [cx, cy + r * 0.7],
              [cx - r * 0.6, cy + r * 0.1],
            ).fill(color);
            // checkmark
            doc.moveTo(cx - r * 0.25, cy)
              .lineTo(cx - r * 0.05, cy + r * 0.2)
              .lineTo(cx + r * 0.3,  cy - r * 0.2)
              .lineWidth(2).strokeColor(PAPER).stroke();
            break;
          }
          case 'pin': {
            doc.circle(cx, cy - r * 0.2, r * 0.5).fill(color);
            doc.circle(cx, cy - r * 0.2, r * 0.2).fill(PAPER);
            doc.polygon([cx - r * 0.3, cy + r * 0.15], [cx + r * 0.3, cy + r * 0.15], [cx, cy + r * 0.7]).fill(color);
            break;
          }
          case 'phone': {
            doc.roundedRect(cx - r * 0.6, cy - r * 0.6, r * 1.2, r * 1.2, r * 0.4).fill(color);
            // handset hint
            doc.moveTo(cx - r * 0.3, cy - r * 0.3)
              .lineTo(cx + r * 0.1, cy + r * 0.1)
              .bezierCurveTo(cx + r * 0.25, cy + r * 0.25, cx + r * 0.4, cy + r * 0.25, cx + r * 0.5, cy + r * 0.1)
              .lineWidth(2).strokeColor(PAPER).stroke();
            break;
          }
          case 'email': {
            doc.roundedRect(cx - r * 0.7, cy - r * 0.45, r * 1.4, r * 0.95, 2).fill(color);
            // flap (V)
            doc.moveTo(cx - r * 0.7, cy - r * 0.45)
              .lineTo(cx, cy + r * 0.05)
              .lineTo(cx + r * 0.7, cy - r * 0.45)
              .lineWidth(1.2).strokeColor(PAPER).stroke();
            break;
          }
          case 'globe': {
            doc.circle(cx, cy, r * 0.65).fill(color);
            // longitudes/latitudes
            doc.moveTo(cx, cy - r * 0.65).lineTo(cx, cy + r * 0.65)
              .lineWidth(0.8).strokeColor(PAPER).stroke();
            doc.moveTo(cx - r * 0.65, cy).lineTo(cx + r * 0.65, cy)
              .lineWidth(0.8).strokeColor(PAPER).stroke();
            doc.ellipse(cx, cy, r * 0.32, r * 0.65)
              .lineWidth(0.8).strokeColor(PAPER).stroke();
            break;
          }
        }
        doc.restore();
      };

      // ====================================================================
      //  DECORATIVE PRIMITIVES
      // ====================================================================

      // Chained DNA helix decoration — 4 linked "infinity-like" loops for the header
      const drawChainedHelix = (xStart: number, y: number, count = 5, loopW = 16) => {
        for (let i = 0; i < count; i++) {
          const cx = xStart + i * loopW;
          // navy figure-eight loop
          doc.moveTo(cx - loopW / 2, y)
            .bezierCurveTo(cx - loopW / 4, y - 8, cx + loopW / 4, y + 8, cx + loopW / 2, y)
            .lineWidth(1.6).strokeColor(GOLD).stroke();
          doc.moveTo(cx - loopW / 2, y)
            .bezierCurveTo(cx - loopW / 4, y + 8, cx + loopW / 4, y - 8, cx + loopW / 2, y)
            .lineWidth(1.6).strokeColor(GOLD_SOFT).stroke();
          // nucleotide dots at crossings
          doc.circle(cx, y, 1.4).fill(GOLD);
        }
      };

      // Scroll flourish — long horizontal stem with an elegant curl at the
      // outer end (the end pointing away from the centered result text).
      // `cx,cy` = the inner anchor point (next to the text). `dir` 1=right, -1=left.
      const drawScrollFlourish = (
        cx: number, cy: number, scale: number, dir: 1 | -1, color: string,
      ) => {
        const s  = scale;
        const d  = dir;
        const lw = 1.4;

        // 1. Long horizontal stem with a very gentle S
        const stemEndX = cx + d * s * 38;
        doc.moveTo(cx, cy)
          .bezierCurveTo(
            cx + d * s * 12, cy - s * 0.6,
            cx + d * s * 26, cy + s * 0.6,
            stemEndX,        cy,
          )
          .lineWidth(lw).strokeColor(color).stroke();

        // 2. Ornate outer curl — single spiral that loops up, back, and tucks under
        doc.moveTo(stemEndX, cy)
          .bezierCurveTo(
            stemEndX + d * s * 6,  cy - s * 1,
            stemEndX + d * s * 9,  cy - s * 6,
            stemEndX + d * s * 4,  cy - s * 8,
          )
          .bezierCurveTo(
            stemEndX - d * s * 2,  cy - s * 9,
            stemEndX - d * s * 5,  cy - s * 5,
            stemEndX - d * s * 2,  cy - s * 3,
          )
          .lineWidth(lw).strokeColor(color).stroke();

        // 3. Small mirror under-curl back near the inner anchor
        doc.moveTo(cx + d * s * 4, cy + s * 0.5)
          .bezierCurveTo(
            cx + d * s * 8,  cy + s * 3,
            cx + d * s * 14, cy + s * 4,
            cx + d * s * 18, cy + s * 2,
          )
          .bezierCurveTo(
            cx + d * s * 22, cy + s * 0.5,
            cx + d * s * 20, cy + s * 1.5,
            cx + d * s * 18, cy + s * 1,
          )
          .lineWidth(lw).strokeColor(color).stroke();

        // 4. Inner anchor accent — small diamond closest to the result text
        doc.polygon(
          [cx,         cy - s * 2],
          [cx + d * 2, cy        ],
          [cx,         cy + s * 2],
          [cx - d * 2, cy        ],
        ).fill(color);

        // 5. Tiny center dot inside the outer curl
        doc.circle(stemEndX + d * s * 3, cy - s * 5.5, lw * 0.9).fill(color);
      };

      // ====================================================================
      //  HEADER BAND — full-width, flush with top edge
      // ====================================================================
      const drawHeaderBand = () => {
        const HDR_X = 0, HDR_Y = 0, HDR_W = PW, HDR_H = 86;
        doc.rect(HDR_X, HDR_Y, HDR_W, HDR_H).fill(NAVY);
        doc.rect(HDR_X, HDR_Y + HDR_H - 4, HDR_W, 4).fill(GOLD);

        // Logo badge (left)
        const HL_R = 30;
        const HL_CX = HDR_X + 20 + HL_R;
        const HL_CY = HDR_Y + HDR_H / 2;
        doc.circle(HL_CX, HL_CY, HL_R + 2).fill(GOLD);
        doc.circle(HL_CX, HL_CY, HL_R).fill(NAVY);
        doc.circle(HL_CX, HL_CY, HL_R).lineWidth(1.5).strokeColor(GOLD).stroke();
        if (logoPng96) {
          doc.save();
          doc.circle(HL_CX, HL_CY, HL_R - 3).clip();
          doc.image(logoPng96, HL_CX - HL_R + 3, HL_CY - HL_R + 3, {
            width: (HL_R - 3) * 2, height: (HL_R - 3) * 2,
          });
          doc.restore();
        } else {
          doc.font('Helvetica-Bold').fontSize(8).fillColor(GOLD)
            .text('PETMAZA', HL_CX - HL_R + 4, HL_CY - 8, {
              width: (HL_R - 4) * 2, align: 'center', lineBreak: false,
            });
          doc.font('Helvetica-Bold').fontSize(7).fillColor(PAPER)
            .text('DNA LABS', HL_CX - HL_R + 4, HL_CY + 2, {
              width: (HL_R - 4) * 2, align: 'center', lineBreak: false,
            });
        }

        // Title text (single line, centered vertically in the band)
        const HT_X = HL_CX + HL_R + 18;
        doc.font('Helvetica-Bold').fontSize(28).fillColor(PAPER)
          .text('PETMAZA  DNA  SERVICE', HT_X, HDR_Y + (HDR_H - 28) / 2 - 2, { lineBreak: false });

        // Right-side chained DNA decoration
        drawChainedHelix(HDR_X + HDR_W - 110, HDR_Y + HDR_H / 2, 5, 16);
      };

      // ====================================================================
      //  FOOTER BAND (3 columns, text-only, gold dividers) — full-width
      // ====================================================================
      const drawFooterBand = () => {
        const FT_H = 62;
        const FT_X = 0, FT_Y = PH - FT_H, FT_W = PW;
        doc.rect(FT_X, FT_Y, FT_W, FT_H).fill(NAVY);
        doc.rect(FT_X, FT_Y, FT_W, 3).fill(GOLD);

        // Caption labels above each cell, plus value text
        const items: Array<{ lbl: string; lines: string[]; widthShare: number }> = [
          { lbl: 'ADDRESS', lines: ['Near Hanuman Mandir, Khanda Colony,', 'Sai Simran Bldg, Shop No. 10, Panvel'], widthShare: 2.4 },
          { lbl: 'PHONE',   lines: ['+91 70212 10753'],             widthShare: 1.2 },
          { lbl: 'WEB',     lines: ['www.petmaza.com'],             widthShare: 1.2 },
        ];
        const totalShare = items.reduce((a, b) => a + b.widthShare, 0);
        let x = FT_X + 16;
        items.forEach((it, idx) => {
          const cellW = (FT_W - 32) * (it.widthShare / totalShare);
          const textX = x + 4;
          const textW = cellW - 12;
          // tiny gold caption
          doc.font('Helvetica-Bold').fontSize(8).fillColor(GOLD)
            .text(it.lbl, textX, FT_Y + 10, { width: textW, lineBreak: false, characterSpacing: 2 });
          // value lines
          if (it.lines.length === 1) {
            doc.font('Helvetica-Bold').fontSize(13).fillColor(PAPER)
              .text(it.lines[0], textX, FT_Y + 30, { width: textW, lineBreak: false });
          } else {
            doc.font('Helvetica-Bold').fontSize(10.5).fillColor(PAPER)
              .text(it.lines[0], textX, FT_Y + 26, { width: textW, lineBreak: false });
            doc.font('Helvetica-Bold').fontSize(10.5).fillColor(GOLD_SOFT)
              .text(it.lines[1], textX, FT_Y + 42, { width: textW, lineBreak: false });
          }
          x += cellW;
          if (idx < items.length - 1) {
            doc.moveTo(x - 4, FT_Y + 14).lineTo(x - 4, FT_Y + FT_H - 12)
              .lineWidth(0.6).strokeColor(GOLD).stroke();
          }
        });
      };

      // ====================================================================
      //  PAGE 1 — COVER
      // ====================================================================

      doc.rect(0, 0, PW, PH).fill(CREAM);

      // Big centered PetMaza logo
      const heroCX = PW / 2;
      const heroCY = 150;
      const heroR  = 80;
      doc.circle(heroCX, heroCY, heroR + 4).fill(GOLD);
      doc.circle(heroCX, heroCY, heroR).fill(NAVY);
      doc.circle(heroCX, heroCY, heroR).lineWidth(2).strokeColor(GOLD).stroke();
      if (logoPng240) {
        doc.save();
        doc.circle(heroCX, heroCY, heroR - 4).clip();
        doc.image(logoPng240, heroCX - heroR + 4, heroCY - heroR + 4, {
          width: (heroR - 4) * 2, height: (heroR - 4) * 2,
        });
        doc.restore();
      }

      // "PETMAZA DNA SERVICE" title under the logo
      const serviceTitleY = heroCY + heroR + 22;
      doc.font('Helvetica-Bold').fontSize(38).fillColor(NAVY)
        .text('PETMAZA DNA SERVICE', 0, serviceTitleY, {
          width: PW, align: 'center', lineBreak: false, characterSpacing: 2,
        });
      // Gold accent line + center diamond under the title
      const accW = 320;
      doc.moveTo((PW - accW) / 2, serviceTitleY + 50).lineTo(PW / 2 - 10, serviceTitleY + 50)
        .lineWidth(1).strokeColor(GOLD).stroke();
      doc.moveTo(PW / 2 + 10, serviceTitleY + 50).lineTo((PW + accW) / 2, serviceTitleY + 50)
        .lineWidth(1).strokeColor(GOLD).stroke();
      doc.polygon([PW / 2, serviceTitleY + 44], [PW / 2 + 6, serviceTitleY + 50],
                   [PW / 2, serviceTitleY + 56], [PW / 2 - 6, serviceTitleY + 50]).fill(GOLD);

      // Three info pills (ISSUED FOR / CERT ID / ISSUE DATE) — with icons
      const infoY = 340;
      const infoH = 60;
      const infoItems = [
        { icon: 'person',   lbl: 'ISSUED FOR', val: data.customerName || 'N/A' },
        { icon: 'flask',    lbl: 'CERT ID',    val: certNumber(data.requestId, data.birdIndex) },
        { icon: 'calendar', lbl: 'ISSUE DATE', val: fmt(data.testDate) },
      ];
      const infoCellW = (PW - 80) / 3;
      infoItems.forEach((it, i) => {
        const cellX = 40 + i * infoCellW;
        // icon
        drawIcon(it.icon, cellX + 30, infoY + infoH / 2, 24, GOLD);
        // text
        doc.font('Helvetica-Bold').fontSize(10).fillColor(MUTED)
          .text(it.lbl, cellX + 50, infoY + 10, { lineBreak: false, characterSpacing: 1.5 });
        doc.font('Helvetica-Bold').fontSize(14).fillColor(NAVY)
          .text(it.val, cellX + 50, infoY + 28, { width: infoCellW - 60, lineBreak: false, ellipsis: true });
        // vertical divider between cells
        if (i < infoItems.length - 1) {
          doc.moveTo(cellX + infoCellW - 4, infoY + 10).lineTo(cellX + infoCellW - 4, infoY + infoH - 10)
            .lineWidth(0.4).strokeColor(GOLD).stroke();
        }
      });

      drawFooterBand();

      // ====================================================================
      //  PAGE 2 — CERTIFICATE CARD
      // ====================================================================

      doc.addPage({ size: [PW, PH], margin: 0 });

      doc.rect(0, 0, PW, PH).fill(CREAM);
      drawHeaderBand();

      // Title (left)
      const TITLE_Y = 116;
      doc.font('Times-BoldItalic').fontSize(42).fillColor(NAVY)
        .text('Certificate', 50, TITLE_Y, { lineBreak: false });
      const certW = doc.widthOfString('Certificate');
      doc.font('Times-Italic').fontSize(20).fillColor(INK)
        .text(' of DNA Sexing', 50 + certW + 4, TITLE_Y + 22, { lineBreak: false });
      // Gold underline + diamond
      doc.moveTo(50, TITLE_Y + 52).lineTo(50 + certW - 30, TITLE_Y + 52)
        .lineWidth(1.2).strokeColor(GOLD).stroke();
      doc.polygon([50 + certW - 22, TITLE_Y + 48], [50 + certW - 18, TITLE_Y + 52],
                   [50 + certW - 22, TITLE_Y + 56], [50 + certW - 26, TITLE_Y + 52]).fill(GOLD);

      // QR with frame (right) — smaller so it doesn't intrude into the field area
      const qrSZ = 78;
      const qrFrameW = qrSZ + 14;
      const qrFrameH = qrSZ + 22;
      const qrFrameX = PW - qrFrameW - 56;
      const qrFrameY = TITLE_Y - 4;
      doc.roundedRect(qrFrameX, qrFrameY, qrFrameW, qrFrameH, 4).fill(PAPER);
      doc.roundedRect(qrFrameX, qrFrameY, qrFrameW, qrFrameH, 4)
        .lineWidth(0.8).strokeColor(GOLD).stroke();
      doc.image(qrBuffer, qrFrameX + 7, qrFrameY + 7, { width: qrSZ, height: qrSZ });
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED)
        .text('SCAN TO VERIFY', qrFrameX, qrFrameY + qrSZ + 9, {
          width: qrFrameW, align: 'center', lineBreak: false, characterSpacing: 1.2,
        });

      // Data fields with icons (two columns) — start BELOW the QR code.
      // QR ends at qrFrameY + qrFrameH = (TITLE_Y - 4) + (78 + 22) = TITLE_Y + 96
      // so we start fields at TITLE_Y + 110 to give a clear 14px gap.
      const FIELDS_Y = TITLE_Y + 110;
      const ROW_H = 30;
      const COL1_X = 60;
      const COL2_X = 430;
      const ICON_X_OFF = 0;
      const LBL_X_OFF = 22;
      const VAL_X_OFF = 130;

      const drawFieldWithIcon = (icon: string, lbl: string, val: string, baseX: number, y: number) => {
        drawIcon(icon, baseX + ICON_X_OFF + 10, y + 8, 22, GOLD);
        doc.font('Helvetica-Bold').fontSize(12).fillColor(MUTED)
          .text(lbl, baseX + LBL_X_OFF + 8, y + 1, { lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(13).fillColor(INK)
          .text(val || 'N/A', baseX + VAL_X_OFF, y + 1, {
            lineBreak: false, width: 230, ellipsis: true,
          });
      };

      drawFieldWithIcon('tag',       'Bird ID / Band', data.bandId,       COL1_X, FIELDS_Y + 0 * ROW_H);
      drawFieldWithIcon('home',      'Farm Name',      data.farm,         COL1_X, FIELDS_Y + 1 * ROW_H);
      drawFieldWithIcon('person',    'Submitted By',   data.customerName, COL1_X, FIELDS_Y + 2 * ROW_H);
      drawFieldWithIcon('bird',      'Species',        data.species,      COL1_X, FIELDS_Y + 3 * ROW_H);

      drawFieldWithIcon('calendar',  'Received Date',  fmt(data.testDate),                          COL2_X, FIELDS_Y + 0 * ROW_H);
      drawFieldWithIcon('bird',      'Bird Name',      data.birdName || 'N/A',                      COL2_X, FIELDS_Y + 1 * ROW_H);
      drawFieldWithIcon('drop',      'Specimen',       'Feather',                                   COL2_X, FIELDS_Y + 2 * ROW_H);
      drawFieldWithIcon('shield',    'Cert ID',        certNumber(data.requestId, data.birdIndex),  COL2_X, FIELDS_Y + 3 * ROW_H);

      // "DNA SEXING RESULT" label with side lines
      const RES_LBL_Y = FIELDS_Y + 4 * ROW_H + 14;
      doc.font('Helvetica-Bold').fontSize(11).fillColor(MUTED);
      const resLblText = 'DNA SEXING RESULT';
      const resLblW = doc.widthOfString(resLblText) + (resLblText.length - 1) * 3;
      const resLblX = (PW - resLblW) / 2;
      // left line
      doc.moveTo(60, RES_LBL_Y + 5).lineTo(resLblX - 14, RES_LBL_Y + 5)
        .lineWidth(0.8).strokeColor(GOLD).stroke();
      // right line
      doc.moveTo(resLblX + resLblW + 14, RES_LBL_Y + 5).lineTo(PW - 60, RES_LBL_Y + 5)
        .lineWidth(0.8).strokeColor(GOLD).stroke();
      doc.font('Helvetica-Bold').fontSize(11).fillColor(MUTED)
        .text(resLblText, resLblX, RES_LBL_Y, { lineBreak: false, characterSpacing: 3 });

      // Result hero text — serif (Times-Bold) for an elegant, certificate feel
      const resFS = 66;
      const resCharSp = 6;
      doc.font('Times-Bold').fontSize(resFS);
      const resTextW = doc.widthOfString(resultLabel) + (resultLabel.length - 1) * resCharSp;
      const resTextX = (PW - resTextW) / 2;
      const resTextY = RES_LBL_Y + 18;

      doc.font('Times-Bold').fontSize(resFS).fillColor(resultColor)
        .text(resultLabel, resTextX, resTextY, {
          width: resTextW + 6, lineBreak: false, characterSpacing: resCharSp,
        });

      // Scroll flourishes flanking the result (proper Victorian-style scrolls)
      const flourishY = resTextY + resFS / 2 + 2;
      drawScrollFlourish(resTextX - 30, flourishY, 1.4, -1, GOLD);
      drawScrollFlourish(resTextX + resTextW + 30, flourishY, 1.4, 1, GOLD);

      drawFooterBand();

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
