// Server-rendered DNA certificate verification page.
//
// This is the page a QR code on a printed DNA card opens. It is a direct port of
// the old petmaza-frontend page (src/pages/Services/DnaVerifyPage.js) — same
// navy/gold certificate look — but rendered here instead, because the storefront
// that used to host /dna-verify no longer has that route.
//
// Deliberately zero JavaScript and zero external assets: a card scanned on a
// patchy mobile connection in the field must render on first paint, and a page
// whose design depends on a CDN is a page that breaks silently years from now.
// The React original sized its border SVG with a ResizeObserver; here the same
// triple border is pure CSS so it stays responsive without script.

export interface DnaVerificationView {
  certNumber: string;
  birdIndex: number;
  birdName?: string;
  bandId?: string;
  species?: string;
  dnaResult?: 'male' | 'female' | 'inconclusive' | null;
  farm?: string;
  customerName?: string;
  testDate?: Date | string;
}

const NAVY = '#0d1b3e';
const GOLD = '#c9a84c';
const CREAM = '#fffef7';

// Every interpolated value below is customer-supplied (bird name, farm, owner),
// so it is escaped without exception — this page is public and unauthenticated.
const esc = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const fmtDate = (d?: Date | string) => {
  if (!d) return 'N/A';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
};

// Hex-mesh watermark, inlined as a data URI so the page stays a single request.
const HEX_WATERMARK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='52'%3E%3Cpolygon points='15,2 45,2 60,26 45,50 15,50 0,26' fill='none' stroke='%23a08030' stroke-width='0.8'/%3E%3C/svg%3E\")";

const shell = (title: string, body: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="${NAVY}">
<title>${esc(title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    background: linear-gradient(160deg, #e8e0c8 0%, #f5f0e4 50%, #e4dcc8 100%);
    font-family: Georgia, 'Times New Roman', serif;
    padding: 32px 16px 48px;
    display: flex; flex-direction: column; align-items: center;
    -webkit-text-size-adjust: 100%;
  }
  .sans { font-family: Arial, Helvetica, sans-serif; }

  /* Page header badge */
  .badge {
    display: inline-block; background: ${NAVY};
    padding: 12px 36px; border-radius: 4px; border: 2px solid ${GOLD};
    text-align: center; margin-bottom: 20px;
  }
  .badge-title { color: #fff; font-size: 20px; font-weight: 700; letter-spacing: 2px; }
  .badge-sub { color: ${GOLD}; font-size: 10px; letter-spacing: 1.5px; margin-top: 3px; }

  /* Certificate card + its triple decorative border */
  .cert {
    position: relative; background: ${CREAM};
    max-width: 680px; width: 100%; border-radius: 2px;
    box-shadow: 0 16px 56px rgba(13, 27, 62, 0.25);
  }
  .cert::before, .cert::after {
    content: ''; position: absolute; pointer-events: none; z-index: 2;
  }
  .cert::before { inset: 1px;  border: 8px solid ${NAVY}; }
  .cert::after  { inset: 12px; border: 2.5px solid ${GOLD}; }
  .cert-inner-rule {
    position: absolute; inset: 18px; z-index: 2; pointer-events: none;
    border: 0.6px dashed ${GOLD};
  }
  .corner { position: absolute; width: 12px; height: 12px; background: ${GOLD}; z-index: 3; }
  .corner::after { content: ''; position: absolute; inset: 3px; background: ${NAVY}; }
  .corner.tl { top: 4px; left: 4px; }
  .corner.tr { top: 4px; right: 4px; }
  .corner.bl { bottom: 4px; left: 4px; }
  .corner.br { bottom: 4px; right: 4px; }

  .watermark {
    position: absolute; inset: 0; z-index: 0; pointer-events: none;
    opacity: 0.07; background-image: ${HEX_WATERMARK}; background-repeat: repeat;
  }
  .layer { position: relative; z-index: 1; }

  /* Header band */
  .head { background: ${NAVY}; padding: 26px 32px 22px; border-bottom: 4px solid ${GOLD}; }
  .head-rule { position: absolute; top: 0; left: 0; right: 0; height: 5px;
    background: linear-gradient(90deg, ${GOLD}, #e8c96a, ${GOLD}); }
  .head-row { display: flex; align-items: center; justify-content: center; gap: 14px; }
  .emblem {
    width: 58px; height: 58px; border-radius: 50%; flex-shrink: 0;
    border: 2px solid ${GOLD}; background: rgba(201, 168, 76, 0.12);
    display: flex; align-items: center; justify-content: center; font-size: 28px;
  }
  .lab-name { color: #fff; font-size: 24px; font-weight: 700; letter-spacing: 2px; }
  .lab-sub { color: ${GOLD}; font-size: 12px; letter-spacing: 1.5px; margin-top: 3px; font-style: italic; }

  .pad { padding-left: 36px; padding-right: 36px; }

  .cert-title { color: ${NAVY}; font-size: 15px; font-weight: 700; letter-spacing: 1.5px; }
  .rule-gold { height: 2px; margin: 10px 0 6px;
    background: linear-gradient(90deg, transparent, ${GOLD}, transparent); }
  .rule-gold-faint { height: 1px; margin-top: 8px;
    background: linear-gradient(90deg, transparent, ${GOLD}55, transparent); }
  .cert-no { color: #888; font-size: 11px; }
  .cert-no strong { color: ${NAVY}; }

  /* Status banner */
  .banner {
    border-radius: 8px; padding: 12px 20px; margin-top: 14px;
    display: flex; align-items: center; gap: 12px;
  }
  .banner-verified { background: linear-gradient(135deg, #14532d, #166534);
    box-shadow: 0 4px 14px rgba(21, 128, 61, 0.3); }
  .banner-pending { background: linear-gradient(135deg, #78350f, #92400e);
    box-shadow: 0 4px 14px rgba(146, 64, 14, 0.3); }
  .banner-icon {
    width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
    background: rgba(255, 255, 255, 0.15); border: 2px solid #86efac;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 20px; font-weight: 900; line-height: 1;
  }
  .banner-pending .banner-icon { border-color: #fcd34d; }
  .banner-title { color: #fff; font-weight: 700; font-size: 13px; }
  .banner-note { color: #bbf7d0; font-size: 11px; margin-top: 2px; }
  .banner-pending .banner-note { color: #fde68a; }

  /* DNA result */
  .result { margin-top: 14px; border-radius: 12px; overflow: hidden; }
  .result-cap { height: 6px; }
  .result-body { padding: 22px 16px 18px; text-align: center; }
  .result-label { color: #aaa; font-size: 10px; letter-spacing: 3px; margin-bottom: 14px; }
  .result-badge {
    display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
    width: 130px; height: 130px; border-radius: 50%; margin: 0 auto 14px;
  }
  .result-text { color: #fff; font-size: 26px; font-weight: 900; letter-spacing: 2px; line-height: 1; }
  .result-sym { color: rgba(255, 255, 255, 0.88); font-size: 30px; line-height: 1; margin-top: 2px; }
  .result-foot { color: #999; font-size: 11px; font-style: italic; }

  /* Details */
  .section-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .section-head span { color: #888; font-size: 10px; letter-spacing: 1.5px; white-space: nowrap; }
  .section-head i { flex: 1; height: 1px; background: #d0c8a8; }
  .rows { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; }
  .row {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding: 9px 10px; gap: 8px; border-bottom: 1px solid #e8e0c8;
  }
  /* Zebra by visual row, not by source order: in the 2-column desktop layout a
     plain odd/even stripe tints the whole left column instead, which reads as a
     highlight. Pairs of cells share a tint here so the banding runs across. */
  .row:nth-child(4n+1), .row:nth-child(4n+2) { background: #f4efe0; }
  .row dt { color: #777; font-size: 12px; flex-shrink: 0; margin: 0; }
  .row dd { color: ${NAVY}; font-weight: 700; font-size: 12px; text-align: right;
    word-break: break-word; margin: 0; }

  .declaration {
    margin-top: 18px; padding: 14px 16px; background: #f9f5e8;
    border-left: 4px solid ${GOLD}; border-radius: 0 6px 6px 0;
  }
  .declaration h2 { color: ${NAVY}; font-weight: 700; font-size: 12px; margin: 0 0 6px; }
  .declaration p { color: #555; font-size: 11px; line-height: 1.7; margin: 0; }

  .sign { margin-top: 18px; }
  .sign-line { width: 160px; height: 1px; background: #aaa; margin-bottom: 5px; }
  .sign-name { color: #333; font-size: 11px; font-weight: 700; }
  .sign-role { color: #888; font-size: 10px; }

  /* Generous padding on purpose: the decorative border is drawn over the card
     at insets of 12/18px, so anything closer than that to an edge gets a gold
     rule struck through it. The band bleeds to the edge, its text does not. */
  .foot {
    position: relative; margin-top: 20px; background: ${NAVY}; padding: 24px 44px 26px;
    display: flex; justify-content: space-between; align-items: center;
    flex-wrap: wrap; gap: 4px;
  }
  .foot-rule { position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: linear-gradient(90deg, ${GOLD}, #e8c96a, ${GOLD}); }
  .foot-addr { color: #aaa; font-size: 10px; }
  .foot-site { color: ${GOLD}; font-size: 11px; font-weight: 700; text-decoration: none; }

  .fail {
    background: #fff; border-radius: 8px; padding: 40px 32px; text-align: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12); border: 2px solid #fee2e2;
    max-width: 480px; width: 100%;
  }
  .fail-mark { font-size: 48px; margin-bottom: 12px; }
  .fail h1 { color: #b91c1c; font-size: 20px; margin: 0 0 8px; }
  .fail p { color: #666; margin: 0; font-size: 14px; }

  /* Phone: single-column details and tighter gutters (matches the old page's
     600px isMobile breakpoint). */
  @media (max-width: 600px) {
    body { padding: 16px 8px 40px; }
    .badge { padding: 10px 20px; }
    .badge-title { font-size: 15px; }
    .head { padding: 20px 18px 16px; }
    .head-row { justify-content: flex-start; }
    .emblem { width: 46px; height: 46px; font-size: 22px; }
    .lab-name { font-size: 17px; }
    .lab-sub { font-size: 10px; }
    .pad { padding-left: 14px; padding-right: 14px; }
    .cert-title { font-size: 12px; }
    .banner { padding: 10px 14px; }
    .result-body { padding: 18px 12px 16px; }
    .result-badge { width: 110px; height: 110px; }
    .result-text { font-size: 20px; }
    .result-sym { font-size: 24px; }
    /* Single column — restore plain odd/even banding. */
    .rows { grid-template-columns: 1fr; }
    .row:nth-child(4n+2) { background: transparent; }
    .row:nth-child(odd) { background: #f4efe0; }
    .foot { padding: 22px 28px 24px; }
  }

  /* Scanned certificates get printed and filed often enough to be worth it. */
  @media print {
    body { background: #fff; padding: 0; }
    .badge { display: none; }
    .cert { box-shadow: none; max-width: 100%; }
  }
</style>
</head>
<body>
${body}
</body>
</html>`;

export const renderDnaVerificationError = (message: string) => shell(
  'Verification Failed — Petmaza DNA Labs',
  `<div class="badge">
    <div class="badge-title">PETMAZA DNA LABS</div>
    <div class="badge-sub">CERTIFICATE VERIFICATION PORTAL</div>
  </div>
  <main class="fail sans">
    <div class="fail-mark">&#10060;</div>
    <h1>Verification Failed</h1>
    <p>${esc(message)}</p>
  </main>`,
);

export const renderDnaVerificationPage = (data: DnaVerificationView) => {
  const isMale = data.dnaResult === 'male';
  const isFemale = data.dnaResult === 'female';
  const hasResult = isMale || isFemale || data.dnaResult === 'inconclusive';

  const resultColor = isMale ? '#0044aa' : isFemale ? '#9d0050' : '#374151';
  const resultLabel = isMale ? 'MALE' : isFemale ? 'FEMALE' : 'INCONCLUSIVE';
  const resultSymbol = isMale ? '&#9794;' : isFemale ? '&#9792;' : '';
  const resultBg = isMale
    ? 'linear-gradient(135deg,#ddeeff,#eef4ff)'
    : isFemale ? 'linear-gradient(135deg,#fde8f2,#fff0f8)'
      : 'linear-gradient(135deg,#f3f4f6,#f9fafb)';
  const resultGrad = isMale
    ? 'linear-gradient(135deg,#0033aa,#0066cc)'
    : isFemale ? 'linear-gradient(135deg,#9d0050,#cc006a)'
      : 'linear-gradient(135deg,#374151,#6b7280)';

  const rows: Array<[string, string]> = [
    ['Certificate No', data.certNumber],
    ['Bird ID / Band', data.bandId || 'N/A'],
    ['Bird Name', data.birdName || `Bird ${data.birdIndex + 1}`],
    ['Species', data.species || 'N/A'],
    ['Farm / Loft', data.farm || 'N/A'],
    ['Submitted By', data.customerName || 'N/A'],
    ['Report Date', fmtDate(data.testDate)],
    ['Method', 'PCR-Based DNA Sexing'],
    ['Lab', 'Petmaza DNA Labs'],
    ['Validity', 'Lifetime'],
  ];

  // A record with no result yet is still a genuine record — but showing the
  // green "Verified" banner over a blank result would read as a confirmed test.
  const banner = hasResult
    ? `<div class="banner banner-verified">
        <div class="banner-icon">&#10003;</div>
        <div>
          <div class="banner-title sans">Certificate Verified &#x2705;</div>
          <div class="banner-note sans">This certificate is authentic and issued by Petmaza DNA Labs</div>
        </div>
      </div>`
    : `<div class="banner banner-pending">
        <div class="banner-icon">&#8943;</div>
        <div>
          <div class="banner-title sans">Result Pending</div>
          <div class="banner-note sans">This record is genuine, but its DNA result has not been published yet</div>
        </div>
      </div>`;

  const resultBlock = hasResult
    ? `<div class="result" style="box-shadow:0 6px 24px ${resultColor}28;border:1.5px solid ${resultColor}35;">
        <div class="result-cap" style="background:${resultGrad};"></div>
        <div class="result-body" style="background:${resultBg};">
          <div class="result-label sans">DNA RESULT</div>
          <div class="result-badge" style="background:${resultGrad};box-shadow:0 8px 28px ${resultColor}55;">
            <div class="result-text">${resultLabel}</div>
            <div class="result-sym">${resultSymbol}</div>
          </div>
          <div class="result-foot sans">Certified by Petmaza DNA Labs</div>
        </div>
      </div>`
    : '';

  // Banding is handled in CSS (:nth-child) because it has to differ between the
  // one- and two-column layouts, which only the stylesheet knows about.
  const rowsHtml = rows.map(([label, value]) => `
        <div class="row">
          <dt class="sans">${esc(label)}</dt>
          <dd class="sans">${esc(value)}</dd>
        </div>`).join('');

  const body = `<div class="badge">
    <div class="badge-title">PETMAZA DNA LABS</div>
    <div class="badge-sub">CERTIFICATE VERIFICATION PORTAL</div>
  </div>

  <main class="cert">
    <div class="cert-inner-rule"></div>
    <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
    <div class="watermark"></div>

    <div class="layer head">
      <div class="head-rule"></div>
      <div class="head-row">
        <div class="emblem">&#129516;</div>
        <div>
          <div class="lab-name">PETMAZA DNA LABS</div>
          <div class="lab-sub">Certified Laboratory for Avian DNA Analysis</div>
        </div>
      </div>
    </div>

    <div class="layer pad" style="padding-top:18px;text-align:center;">
      <h1 class="cert-title" style="margin:0;">CERTIFICATE OF DNA SEXING ANALYSIS</h1>
      <div class="rule-gold"></div>
      <div class="cert-no sans">Certificate No:&nbsp;<strong>${esc(data.certNumber)}</strong></div>
      <div class="rule-gold-faint"></div>
    </div>

    <div class="layer pad">${banner}</div>
    <div class="layer pad">${resultBlock}</div>

    <div class="layer pad" style="padding-top:18px;">
      <div class="section-head"><i></i><span class="sans">CERTIFICATE DETAILS</span><i></i></div>
      <dl class="rows" style="margin:0;">${rowsHtml}
      </dl>
    </div>

    <div class="layer pad">
      <div class="declaration">
        <h2 class="sans">Declaration</h2>
        <p class="sans">This certificate is issued on the basis of molecular DNA analysis conducted at
        Petmaza DNA Labs. The result pertains to the specific bird sample identified herein.
        This document is digitally verifiable and has been authenticated.</p>
      </div>
    </div>

    <div class="layer pad sign">
      <div class="sign-line"></div>
      <div class="sign-name sans">Authorised Signatory</div>
      <div class="sign-role sans">Lab Director, Petmaza DNA Labs</div>
    </div>

    <div class="layer pad" style="padding-top:20px;">
      <div class="rule-gold" style="margin:0;"></div>
    </div>

    <div class="layer foot">
      <div class="foot-rule"></div>
      <div class="foot-addr sans">Petmaza DNA Labs, Panvel, Maharashtra, India</div>
      <a class="foot-site sans" href="https://www.petmaza.com">www.petmaza.com</a>
    </div>
  </main>`;

  return shell(`${data.certNumber} — Petmaza DNA Labs`, body);
};
