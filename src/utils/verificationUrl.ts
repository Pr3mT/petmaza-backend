// Base URL that QR codes point at.
//
// These URLs get printed onto physical DNA cards and certificates, so they have
// to keep resolving for as long as the card exists. That rules out FRONTEND_URL:
// the storefront has already moved hosts once (petmaza.com now serves the Expo
// build, which has no /dna-verify route — every card printed against it would
// land the scanner on the shop homepage). The backend owns the verification page
// instead, so the QR points here.
export const getVerificationBaseUrl = () => {
  const raw = process.env.PETMAZA_VERIFICATION_BASE_URL
    || process.env.BACKEND_PUBLIC_URL
    || process.env.APP_BASE_URL
    // Not FRONTEND_URL — see above. Falls back to the live backend rather than
    // localhost, because a localhost QR on a printed card is unrecoverable.
    || (process.env.NODE_ENV === 'production'
      ? 'https://petmaza-backend.onrender.com'
      : 'http://localhost:6969');

  return raw.replace(/\/+$/, '');
};

// Short param names keep the encoded string small, which keeps the QR's module
// count low — it has to survive being printed at ~20mm on a CR80 card.
export const buildDnaVerificationUrl = (requestId: string, birdIndex: number) =>
  `${getVerificationBaseUrl()}/verify/dna?rid=${encodeURIComponent(requestId)}&b=${birdIndex}`;
