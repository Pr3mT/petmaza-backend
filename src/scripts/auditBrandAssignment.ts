import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import Brand from '../models/Brand';

dotenv.config();

/**
 * READ-ONLY audit. Finds products filed under the house brand (PETMAZA) that
 * look like they belong to a real third-party brand, based on the product name.
 *
 * Two passes:
 *   1) name matches an EXISTING brand in the DB  -> just needs re-assigning
 *   2) name starts with a recognised brand keyword that is NOT yet a brand
 *      -> brand needs to be created, then product re-assigned
 */

const HOUSE_BRAND = (process.env.HOUSE_BRAND || 'PETMAZA').trim();

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Known third-party brand keywords that appear in product names. These are
// real manufacturers — anything starting with one of these is NOT a Petmaza
// own-label product. Longest-first matching happens below.
const KNOWN_BRAND_KEYWORDS = [
  'HORMIS',
  'Vitapol',
  'Oropharma',
  'Orlux',
  'Omni Vit',
  'Ventripro',
  'Smaker',
  'Keetup',
  'Hello Feed',
  'Hallofeed',
  'Hi Breed',
  'Sage Square',
  'Star Farm',
  'MUDGO',
];

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log(`Connected to MongoDB\n`);

  const brands = await Brand.find().lean();
  console.log(`All brands in DB (${brands.length}):`);
  brands
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((b) => console.log(`   - ${b.name}`));
  console.log('');

  const houseBrand = brands.find((b) => norm(b.name) === norm(HOUSE_BRAND));
  if (!houseBrand) {
    console.log(`No brand named "${HOUSE_BRAND}" found.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const otherBrands = brands
    .filter((b) => String(b._id) !== String(houseBrand._id))
    .map((b) => ({ name: b.name, n: norm(b.name) }))
    .filter((b) => b.n.length >= 3)
    .sort((a, b) => b.n.length - a.n.length);

  const keywords = KNOWN_BRAND_KEYWORDS
    .map((k) => ({ name: k, n: norm(k) }))
    .sort((a, b) => b.n.length - a.n.length);

  const houseProducts = await Product.find({ brand_id: houseBrand._id })
    .select('name')
    .lean();

  console.log(`House brand: "${houseBrand.name}"  |  products under it: ${houseProducts.length}\n`);

  const existingMatch: { product: string; id: string; brand: string }[] = [];
  const keywordMatch: { product: string; id: string; brand: string }[] = [];
  const leftover: string[] = [];

  for (const p of houseProducts) {
    const n = norm(p.name);
    const padded = ` ${n} `;

    const existing = otherBrands.find((b) => padded.includes(` ${b.n} `) || n.startsWith(b.n + ' '));
    if (existing) {
      existingMatch.push({ product: p.name, id: String(p._id), brand: existing.name });
      continue;
    }
    const kw = keywords.find((b) => padded.includes(` ${b.n} `) || n.startsWith(b.n + ' '));
    if (kw) {
      keywordMatch.push({ product: p.name, id: String(p._id), brand: kw.name });
      continue;
    }
    leftover.push(p.name);
  }

  const group = (rows: { product: string; id: string; brand: string }[]) => {
    const by: Record<string, typeof rows> = {};
    rows.forEach((r) => (by[r.brand] ||= []).push(r));
    return Object.entries(by).sort((a, b) => b[1].length - a[1].length);
  };

  console.log('='.repeat(80));
  console.log(`A) Name matches an EXISTING brand — just re-assign brand_id (${existingMatch.length})`);
  console.log('='.repeat(80));
  group(existingMatch).forEach(([brand, items]) => {
    console.log(`\n→ "${brand}" (${items.length}):`);
    items.forEach((m) => console.log(`   [${m.id}] ${m.product}`));
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log(`B) Name shows a real brand NOT yet in DB — create brand, then re-assign (${keywordMatch.length})`);
  console.log('='.repeat(80));
  group(keywordMatch).forEach(([brand, items]) => {
    console.log(`\n→ "${brand}" (${items.length}):`);
    items.forEach((m) => console.log(`   [${m.id}] ${m.product}`));
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log(`C) No brand keyword detected — generic / likely genuine Petmaza own-label (${leftover.length})`);
  console.log('='.repeat(80));
  leftover.forEach((n) => console.log(`   ${n}`));

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
