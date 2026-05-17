// patch-pdf-gen.js - Rewrites generateDnaResultCertificatePdf to match reference image
const fs = require('fs');
const filePath = require('path').join(__dirname, 'src/services/dnaPdfGenerator.ts');

let content = fs.readFileSync(filePath, 'utf8');

// ─── 1. Update loadLogoBuffer to try JPEG first ────────────────────────────
const OLD_LOAD_LOGO_CANDIDATES = `  const candidates = [
    path.resolve(__dirname, '../../../petmaza-frontend/public/petmaza-logo.svg'),
    path.resolve(__dirname, '../../assets/petmaza-logo.svg'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const svgBuf = fs.readFileSync(p);
        return await sharp(svgBuf, { density: 150 })
          .resize(sizePx, sizePx, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
      } catch { /* fall through */ }
    }
  }
  return null;
}`;

const NEW_LOAD_LOGO_BODY = `  // Try petmaza.jpeg first (most reliable, actual brand logo)
  const jpegPath = path.resolve(__dirname, '../../../petmaza-frontend/public/pets/petmaza.jpeg');
  if (fs.existsSync(jpegPath)) {
    try {
      return await sharp(jpegPath)
        .resize(sizePx, sizePx, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();
    } catch { /* fall through */ }
  }
  const candidates = [
    path.resolve(__dirname, '../../../petmaza-frontend/public/petmaza-logo.svg'),
    path.resolve(__dirname, '../../assets/petmaza-logo.svg'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const svgBuf = fs.readFileSync(p);
        return await sharp(svgBuf, { density: 150 })
          .resize(sizePx, sizePx, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
      } catch { /* fall through */ }
    }
  }
  return null;
}`;

if (content.includes(OLD_LOAD_LOGO_CANDIDATES)) {
  content = content.replace(OLD_LOAD_LOGO_CANDIDATES, NEW_LOAD_LOGO_BODY);
  console.log('✓ Updated loadLogoBuffer to try JPEG first');
} else {
  console.log('i loadLogoBuffer already updated, skipping');
}

// ─── 2. Replace entire generateDnaResultCertificatePdf function ────────────
const funcMarker = '\nexport async function generateDnaResultCertificatePdf(';
const funcStart = content.indexOf(funcMarker);
if (funcStart === -1) { console.error('ERROR: function not found'); process.exit(1); }

const before = content.substring(0, funcStart);

const NEW_FUNCTION = `
export async function generateDnaResultCertificatePdf(
  data: DnaResultCertificateData,
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const PW = 794;
      const PH = 560;

      // -- Colour palette --------------------------------------------------------
      const NAVY       = '#0d1b3e';
      const GOLD       = '#e8a000';
      const DARK       = '#111827';
      const WHITE      = '#ffffff';
      const SKY_BG     = '#d8ecf8';
      const SKY_MID    = '#c0dff0';
      const LGREY      = '#6b7280';
      const CERT_BLUE  = '#1a3a6b';
      const DARK_GREEN = '#1b5e20';
      const RED_BADGE  = '#c62828';
      const LIGHT_BG   = '#d6eaf8';

      const resultLabel = data.dnaResult === 'male'   ? 'Male'
        : data.dnaResult === 'female' ? 'Female' : 'Inconclusive';
      const resultColor = data.dnaResult === 'male'   ? '#0044aa'
        : data.dnaResult === 'female' ? '#9d0050' : '#374151';
      const resultBg    = data.dnaResult === 'male'   ? '#dbeafe'
        : data.dnaResult === 'female' ? '#fce7f3' : '#f3f4f6';

      // -- QR code ---------------------------------------------------------------
      const qrBuffer: Buffer = await QRCode.toBuffer(data.verificationUrl, {
        errorCorrectionLevel: 'H',
        width: 130,
        margin: 1,
        color: { dark: '#000000', light: WHITE },
      });

      // -- PetMaza logo PNG (via sharp, tries JPEG first) -----------------------
      const logoPng110 = await loadLogoBuffer(110);
      const logoPng220 = await loadLogoBuffer(220);

      // -- Bird image for bird panels -------------------------------------------
      const birdPng = await loadPetImage('Bird', 200);

      const doc = new PDFDocument({ size: [PW, PH], margin: 0, autoFirstPage: true });
      const buffers: Buffer[] = [];
      const pass = new PassThrough();
      pass.on('data', (c: Buffer) => buffers.push(c));
      pass.on('end', () => resolve(Buffer.concat(buffers)));
      pass.on('error', reject);
      doc.pipe(pass);

      // =========================================================================
      //  PAGE 1 - PETMAZA DNA SERVICE PROMOTIONAL PAGE (matches reference ad)
      // =========================================================================

      // -- Background ------------------------------------------------------------
      doc.rect(0, 0, PW, PH).fill(LIGHT_BG);
      doc.rect(0, 0, PW, 130).fill('#dff0fb');

      // -- Top-left: PetMaza logo circle ----------------------------------------
      const LOGO_R  = 58;
      const LOGO_CX = 20 + LOGO_R;   // 78
      const LOGO_CY = 8  + LOGO_R;   // 66
      // white halo + navy border
      doc.circle(LOGO_CX, LOGO_CY, LOGO_R + 5).fill(WHITE);
      doc.circle(LOGO_CX, LOGO_CY, LOGO_R + 5).lineWidth(3).strokeColor(NAVY).stroke();
      if (logoPng110) {
        doc.save();
        doc.circle(LOGO_CX, LOGO_CY, LOGO_R).clip();
        doc.image(logoPng110, LOGO_CX - LOGO_R, LOGO_CY - LOGO_R, {
          width: LOGO_R * 2, height: LOGO_R * 2,
        });
        doc.restore();
      } else {
        doc.circle(LOGO_CX, LOGO_CY, LOGO_R).fill(NAVY);
        doc.circle(LOGO_CX, LOGO_CY, LOGO_R - 5).lineWidth(2).strokeColor(GOLD).stroke();
        doc.font('Helvetica-Bold').fontSize(18).fillColor(GOLD)
          .text('PET', LOGO_CX - 24, LOGO_CY - 22, { lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(18).fillColor(WHITE)
          .text('MAZA', LOGO_CX - 28, LOGO_CY + 2, { lineBreak: false });
      }

      // -- Main title: "PET MAZA" + DNA helix row + "DNA SERVICE" ---------------
      const TTL_X = LOGO_CX + LOGO_R + 16;  // 152
      doc.font('Helvetica-Bold').fontSize(52).fillColor(NAVY)
        .text('PET MAZA', TTL_X, 10, { lineBreak: false });
      // DNA helix row at y=72
      const HelY = 72;
      doc.moveTo(TTL_X, HelY + 6).lineTo(TTL_X + 55, HelY + 6)
        .lineWidth(1.5).strokeColor('#78909c').stroke();
      doc.moveTo(TTL_X + 106, HelY + 6).lineTo(TTL_X + 200, HelY + 6)
        .lineWidth(1.5).strokeColor('#78909c').stroke();
      const DHX = TTL_X + 58;
      doc.moveTo(DHX, HelY)
        .bezierCurveTo(DHX + 12, HelY - 10, DHX + 24, HelY + 10, DHX + 36, HelY)
        .lineWidth(2.5).strokeColor(CERT_BLUE).stroke();
      doc.moveTo(DHX, HelY)
        .bezierCurveTo(DHX + 12, HelY + 10, DHX + 24, HelY - 10, DHX + 36, HelY)
        .lineWidth(2.5).strokeColor(GOLD).stroke();
      for (let xi = 0; xi <= 3; xi++) {
        const xp = DHX + xi * 12;
        doc.moveTo(xp, HelY - 5).lineTo(xp, HelY + 5)
          .lineWidth(1).strokeColor('#90a4ae').stroke();
      }
      doc.font('Helvetica-Bold').fontSize(36).fillColor(DARK_GREEN)
        .text('DNA SERVICE', TTL_X + 6, 82, { lineBreak: false });

      // -- "NOW OPEN IN PANVEL" badge (top-right) --------------------------------
      doc.save();
      doc.rotate(-10, { origin: [PW - 96, 65] });
      // red box: "NOW" + big italic "OPEN"
      doc.roundedRect(PW - 208, 5, 200, 60, 8).fill(RED_BADGE);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(WHITE)
        .text('NOW', PW - 208, 12, { width: 200, align: 'center', lineBreak: false });
      doc.font('Helvetica-BoldOblique').fontSize(34).fillColor(WHITE)
        .text('OPEN', PW - 208, 22, { width: 200, align: 'center', lineBreak: false });
      // blue "IN PANVEL" strip
      doc.roundedRect(PW - 194, 67, 172, 28, 5).fill('#0044aa');
      doc.font('Helvetica-Bold').fontSize(14).fillColor(WHITE)
        .text('IN PANVEL', PW - 194, 74, { width: 172, align: 'center', lineBreak: false });
      doc.restore();

      // -- Left: tall bird panel ------------------------------------------------
      const LB_X = 22, LB_Y = 130, LB_W = 162, LB_H = 350;
      doc.save();
      doc.roundedRect(LB_X, LB_Y, LB_W, LB_H, 8).clip();
      if (birdPng) {
        doc.image(birdPng, LB_X, LB_Y, { width: LB_W, height: LB_H });
      } else {
        doc.roundedRect(LB_X, LB_Y, LB_W, LB_H, 8).fill('#90caf9');
      }
      doc.restore();
      doc.roundedRect(LB_X, LB_Y, LB_W, LB_H, 8).lineWidth(2.5).strokeColor(NAVY).stroke();
      // dark label overlay at bottom
      doc.save();
      doc.roundedRect(LB_X, LB_Y + LB_H - 36, LB_W, 36, 8).clip();
      doc.rect(LB_X, LB_Y + LB_H - 36, LB_W, 36).fill(NAVY);
      doc.restore();
      doc.font('Helvetica-Bold').fontSize(12).fillColor(WHITE)
        .text('AFRICAN GRAY', LB_X, LB_Y + LB_H - 21, { width: LB_W, align: 'center', lineBreak: false });

      // -- Center column: x=194, width=370 -------------------------------------
      const CC_X = LB_X + LB_W + 10;   // 194
      const CC_W = 370;

      // "BIRD DNA TESTING SERVICE" navy banner
      doc.roundedRect(CC_X, 130, CC_W, 42, 6).fill(NAVY);
      doc.font('Helvetica-Bold').fontSize(18).fillColor(WHITE)
        .text('BIRD DNA TESTING SERVICE', CC_X, 142, { width: CC_W, align: 'center', lineBreak: false });

      // "AVAILABLE NOW IN NAVI MUMBAI" green banner
      doc.roundedRect(CC_X, 175, CC_W, 26, 4).fill(DARK_GREEN);
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffe082')
        .text('AVAILABLE NOW IN NAVI MUMBAI', CC_X, 184, { width: CC_W, align: 'center', lineBreak: false });

      // Location box (white card with red pin)
      const LOC_Y = 204;
      doc.roundedRect(CC_X, LOC_Y, CC_W, 90, 6).fill(WHITE);
      doc.roundedRect(CC_X, LOC_Y, CC_W, 90, 6).lineWidth(1).strokeColor('#b0c4de').stroke();
      // red location pin icon
      const PIN_X = CC_X + 28, PIN_Y = LOC_Y + 36;
      doc.circle(PIN_X, PIN_Y, 13).fill(RED_BADGE);
      doc.circle(PIN_X, PIN_Y, 5).fill(WHITE);
      doc.polygon([PIN_X - 7, PIN_Y + 10], [PIN_X + 7, PIN_Y + 10], [PIN_X, PIN_Y + 22]).fill(RED_BADGE);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
        .text('LOCATION:', CC_X + 50, LOC_Y + 7, { lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(DARK)
        .text('Near Hanuman Mandir, Khanda Colony,', CC_X + 50, LOC_Y + 24, { lineBreak: false });
      doc.font('Helvetica').fontSize(9.5).fillColor(DARK)
        .text('Sai Simran Building,', CC_X + 50, LOC_Y + 40, { lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(RED_BADGE)
        .text('Shop No. 10,', CC_X + 50, LOC_Y + 57, { continued: true, lineBreak: false });
      doc.font('Helvetica').fontSize(10).fillColor(DARK)
        .text(' Navi Mumbai', { lineBreak: false });

      // "SEND YOUR BIRD SAMPLE AT THIS LOCATION" navy box
      const SEND_Y = LOC_Y + 94;   // 298
      doc.roundedRect(CC_X, SEND_Y, CC_W, 42, 6).fill(NAVY);
      // package icon
      doc.rect(CC_X + 14, SEND_Y + 14, 20, 16).fill('#4db6ac');
      doc.rect(CC_X + 14, SEND_Y + 9, 20, 7).fill(GOLD);
      doc.font('Helvetica-Bold').fontSize(12).fillColor(WHITE)
        .text('SEND YOUR BIRD SAMPLE', CC_X + 44, SEND_Y + 7, { lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(12).fillColor(GOLD)
        .text('AT THIS LOCATION', CC_X + 44, SEND_Y + 24, { lineBreak: false });

      // Three service badges (icons + text)
      const B_Y  = SEND_Y + 48;   // 346
      const B_BW = CC_W / 3;       // 123
      const badgeDefs = [
        { bg: '#e3f2fd', ic: CERT_BLUE,  t1: 'FAST &',       t2: 'RELIABLE',  t3: 'BIRD DNA TESTING' },
        { bg: '#e8f5e9', ic: DARK_GREEN, t1: 'ONLY',         t2: 'FOR BIRDS', t3: '' },
        { bg: '#e3f2fd', ic: CERT_BLUE,  t1: 'PROFESSIONAL', t2: 'SERVICE',   t3: '' },
      ];
      badgeDefs.forEach((b, i) => {
        const BX = CC_X + i * B_BW;
        doc.roundedRect(BX + 2, B_Y, B_BW - 4, 80, 5).fill(b.bg);
        doc.roundedRect(BX + 2, B_Y, B_BW - 4, 80, 5).lineWidth(0.8).strokeColor('#90caf9').stroke();
        const ICX = BX + B_BW / 2;
        const ICY = B_Y + 18;
        doc.circle(ICX, ICY, 14).fill(b.ic);
        // DNA helix mini icon
        doc.moveTo(ICX - 8, ICY - 3)
          .bezierCurveTo(ICX - 3, ICY - 9, ICX + 3, ICY + 3, ICX + 8, ICY - 3)
          .lineWidth(1.5).strokeColor(WHITE).stroke();
        doc.moveTo(ICX - 8, ICY - 3)
          .bezierCurveTo(ICX - 3, ICY + 3, ICX + 3, ICY - 9, ICX + 8, ICY - 3)
          .lineWidth(1.5).strokeColor('#ffe082').stroke();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(DARK)
          .text(b.t1, BX + 2, B_Y + 38, { width: B_BW - 4, align: 'center', lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(8).fillColor(DARK)
          .text(b.t2, BX + 2, B_Y + 49, { width: B_BW - 4, align: 'center', lineBreak: false });
        if (b.t3) doc.font('Helvetica').fontSize(7.5).fillColor(LGREY)
          .text(b.t3, BX + 2, B_Y + 60, { width: B_BW - 4, align: 'center', lineBreak: false });
      });

      // -- Right: two bird panels side-by-side (Macaw + Sun Conure) -------------
      const RB_X  = CC_X + CC_W + 8;              // 572
      const RB_EW = Math.floor((PW - RB_X - 22 - 4) / 2);  // ~98
      const RB_H  = 278;
      const RB_Y  = 202;
      const rBirdLabels = ['MACAW', 'SUN CONURE'];
      for (let i = 0; i < 2; i++) {
        const rbx = RB_X + i * (RB_EW + 4);
        doc.save();
        doc.roundedRect(rbx, RB_Y, RB_EW, RB_H, 7).clip();
        if (birdPng) {
          doc.image(birdPng, rbx, RB_Y, { width: RB_EW, height: RB_H });
        } else {
          doc.roundedRect(rbx, RB_Y, RB_EW, RB_H, 7).fill('#81d4fa');
        }
        doc.restore();
        doc.roundedRect(rbx, RB_Y, RB_EW, RB_H, 7).lineWidth(2).strokeColor(NAVY).stroke();
        // dark label overlay at bottom
        doc.save();
        doc.roundedRect(rbx, RB_Y + RB_H - 28, RB_EW, 28, 7).clip();
        doc.rect(rbx, RB_Y + RB_H - 28, RB_EW, 28).fill(NAVY);
        doc.restore();
        doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE)
          .text(rBirdLabels[i], rbx, RB_Y + RB_H - 16, { width: RB_EW, align: 'center', lineBreak: false });
      }

      // -- Contact bar (full-width, bottom) -------------------------------------
      const CTB_Y = PH - 80;   // 480
      doc.rect(0, CTB_Y, PW, 80).fill(NAVY);
      doc.moveTo(0, CTB_Y).lineTo(PW, CTB_Y).lineWidth(3).strokeColor(GOLD).stroke();
      // phone circle icon
      const PIC_CX = 54, PIC_CY = CTB_Y + 40;
      doc.circle(PIC_CX, PIC_CY, 28).fill('#162d6b');
      doc.circle(PIC_CX, PIC_CY, 22).lineWidth(2).strokeColor('#4060b0').stroke();
      // simple phone shape
      doc.circle(PIC_CX - 5, PIC_CY - 4, 8).fill(WHITE);
      doc.circle(PIC_CX + 5, PIC_CY + 4, 8).fill(WHITE);
      doc.rect(PIC_CX - 5, PIC_CY - 4, 10, 8).fill(WHITE);
      // text
      doc.font('Helvetica-Bold').fontSize(13).fillColor(WHITE)
        .text('CONTACT NUMBER:', 96, CTB_Y + 14, { lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(38).fillColor(GOLD)
        .text('+91 70212 10753', 96, CTB_Y + 30, { lineBreak: false });

      // =========================================================================
      //  PAGE 2 - CERTIFICATE OF DNA SEXING
      // =========================================================================

      doc.addPage({ size: [PW, PH], margin: 0 });

      // -- Sky-blue gradient background ------------------------------------------
      doc.rect(0, 0, PW, PH / 2).fill(SKY_BG);
      doc.rect(0, PH / 2, PW, PH / 2).fill(SKY_MID);

      // -- Outer rounded border --------------------------------------------------
      doc.roundedRect(12, 12, PW - 24, PH - 24, 18)
        .lineWidth(2.5).strokeColor(CERT_BLUE).stroke();

      // -- PetMaza logo watermark (centre, large, semi-transparent) -------------
      const wCX = PW / 2;
      const wCY = PH / 2 + 10;
      doc.save();
      doc.opacity(0.08);
      if (logoPng220) {
        const WM = 280;
        doc.save();
        doc.circle(wCX, wCY, 130).clip();
        doc.image(logoPng220, wCX - WM / 2, wCY - WM / 2, { width: WM, height: WM });
        doc.restore();
      } else {
        // Fallback drawn watermark
        doc.circle(wCX, wCY, 130).lineWidth(4).strokeColor(CERT_BLUE).stroke();
        doc.circle(wCX, wCY, 118).lineWidth(1.5).strokeColor(CERT_BLUE).stroke();
        doc.font('Helvetica-Bold').fontSize(50).fillColor(CERT_BLUE)
          .text('PET', wCX - 70, wCY - 34, { lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(50).fillColor(GOLD)
          .text('MAZA', wCX - 10, wCY - 34, { lineBreak: false });
        doc.font('Helvetica').fontSize(14).fillColor(CERT_BLUE)
          .text('DNA SEXING LABS', wCX - 65, wCY + 22, { lineBreak: false });
        for (let i = 0; i < 6; i++) {
          const ang = (Math.PI / 3) * i;
          const px = wCX + 118 * Math.cos(ang);
          const py = wCY + 118 * Math.sin(ang);
          doc.circle(px, py, 6).fill(CERT_BLUE);
        }
      }
      doc.restore();

      // -- Title: "Certificate of DNA SEXING" -----------------------------------
      const CERT_TITLE_X = 36;
      const TITLE_Y = 26;
      doc.font('Helvetica-BoldOblique').fontSize(38).fillColor(CERT_BLUE)
        .text('Certificate', CERT_TITLE_X, TITLE_Y, { lineBreak: false });
      doc.font('Helvetica-Oblique').fontSize(20).fillColor(DARK)
        .text(' of DNA SEXING', CERT_TITLE_X + 198, TITLE_Y + 14, { lineBreak: false });

      // -- QR code (top-right) --------------------------------------------------
      const qrSZ = 100;
      const qrX  = PW - qrSZ - 26;
      const qrY  = 22;
      doc.rect(qrX - 5, qrY - 5, qrSZ + 10, qrSZ + 20).fill(WHITE);
      doc.rect(qrX - 5, qrY - 5, qrSZ + 10, qrSZ + 20)
        .lineWidth(0.8).strokeColor('#aabbcc').stroke();
      doc.image(qrBuffer, qrX, qrY, { width: qrSZ, height: qrSZ });
      doc.font('Helvetica').fontSize(7).fillColor(LGREY)
        .text('Scan to verify', qrX - 5, qrY + qrSZ + 5, {
          width: qrSZ + 10, align: 'center', lineBreak: false,
        });

      // -- Data fields ----------------------------------------------------------
      const LBL_FS   = 11;
      const VAL_FS   = 11;
      const ROW_GAP  = 28;
      const LBL_X    = 46;
      const VAL_X    = 210;
      const COL2_LBL = 450;
      const COL2_VAL = 580;
      const FIELD_Y  = TITLE_Y + 62;

      const leftRows: [string, string][] = [
        ['Bird ID / Band :',      data.bandId       || 'N/A'],
        ['Farm Name :',           data.farm         || 'N/A'],
        ['Submitted By :',        data.customerName || 'N/A'],
        ['Species :',             data.species      || 'N/A'],
        ['Specimen submitted :',  'Blood'],
      ];
      const rightRows: [string, string][] = [
        ['Received Date :', fmt(data.testDate)],
        ['Report Date :',  fmt(data.testDate)],
        ['Cert ID :',      certNumber(data.requestId, data.birdIndex)],
      ];

      leftRows.forEach(([lbl, val], i) => {
        const ry = FIELD_Y + i * ROW_GAP;
        doc.font('Helvetica-Bold').fontSize(LBL_FS).fillColor(DARK)
          .text(lbl, LBL_X, ry, { lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(VAL_FS).fillColor(CERT_BLUE)
          .text(val, VAL_X, ry, { lineBreak: false });
      });
      rightRows.forEach(([lbl, val], i) => {
        const ry = FIELD_Y + i * ROW_GAP;
        doc.font('Helvetica-Bold').fontSize(LBL_FS).fillColor(DARK)
          .text(lbl, COL2_LBL, ry, { lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(VAL_FS).fillColor(CERT_BLUE)
          .text(val, COL2_VAL, ry, { lineBreak: false });
      });

      // -- Divider ---------------------------------------------------------------
      const DIV_Y = FIELD_Y + leftRows.length * ROW_GAP + 6;
      doc.moveTo(30, DIV_Y).lineTo(PW - 30, DIV_Y)
        .lineWidth(1.5).strokeColor(CERT_BLUE).stroke();

      // -- Result (large, prominent, colored) -----------------------------------
      const FTY      = PH - 50;
      const RES_Y    = DIV_Y + 8;
      const RES_BOX_W = PW - 60;   // 734
      const RES_BOX_H = FTY - RES_Y - 8;
      const RES_BOX_X = 30;

      // Colored background panel
      doc.roundedRect(RES_BOX_X, RES_Y, RES_BOX_W, RES_BOX_H, 12).fill(resultBg);
      doc.roundedRect(RES_BOX_X, RES_Y, RES_BOX_W, RES_BOX_H, 12)
        .lineWidth(2).strokeColor(resultColor).stroke();
      // left accent bar
      doc.roundedRect(RES_BOX_X, RES_Y, 14, RES_BOX_H, 7).fill(resultColor);

      // "DNA SEXING RESULT" label
      doc.font('Helvetica-Bold').fontSize(13).fillColor(LGREY)
        .text('DNA SEXING RESULT', RES_BOX_X + 30, RES_Y + 18, { lineBreak: false });
      // separator line under label
      doc.moveTo(RES_BOX_X + 30, RES_Y + 38)
        .lineTo(RES_BOX_X + 320, RES_Y + 38)
        .lineWidth(1).strokeColor(resultColor).stroke();

      // Large result text (centered)
      const resultFontSize = 80;
      doc.font('Helvetica-Bold').fontSize(resultFontSize).fillColor(resultColor)
        .text(resultLabel.toUpperCase(), RES_BOX_X + 20, RES_Y + 46, {
          width: RES_BOX_W - 40,
          align: 'center',
          lineBreak: false,
        });

      // Decorative DNA helix on the right side of result box
      const DH2X = RES_BOX_X + RES_BOX_W - 80;
      const DH2Y = RES_Y + RES_BOX_H / 2;
      for (let s = 0; s < 4; s++) {
        const sy = DH2Y - 50 + s * 26;
        doc.moveTo(DH2X, sy)
          .bezierCurveTo(DH2X + 20, sy - 12, DH2X + 40, sy + 12, DH2X + 60, sy)
          .lineWidth(2).strokeColor(resultColor).stroke();
        doc.moveTo(DH2X, sy)
          .bezierCurveTo(DH2X + 20, sy + 12, DH2X + 40, sy - 12, DH2X + 60, sy)
          .lineWidth(2).strokeColor(resultColor).stroke();
        doc.moveTo(DH2X + 30, sy - 8).lineTo(DH2X + 30, sy + 8)
          .lineWidth(1).strokeColor(resultColor).stroke();
      }

      // -- Footer band ----------------------------------------------------------
      doc.rect(0, FTY, PW, PH - FTY).fill(CERT_BLUE);
      doc.font('Helvetica').fontSize(9).fillColor(WHITE)
        .text(
          'Near Hanuman Mandir, Khanda Colony, Sai Simran Building, Shop No. 10, Panvel, Navi Mumbai',
          0, FTY + 8, { width: PW, align: 'center', lineBreak: false },
        );
      doc.font('Helvetica').fontSize(8.5).fillColor(GOLD)
        .text(
          'Helpdesk: +91 70212 10753  |  lab@petmaza.com  |  www.petmaza.com',
          0, FTY + 22, { width: PW, align: 'center', lineBreak: false },
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
`;

content = before + NEW_FUNCTION;
fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Rewrote generateDnaResultCertificatePdf');
console.log('Total file size:', content.length, 'chars');
