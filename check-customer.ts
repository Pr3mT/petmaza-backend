import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './src/models/Product';
import './src/models/User';
import './src/models/Category';
import './src/models/Brand';
import './src/models/VendorDetails';
import { ProductService } from './src/services/ProductService';

dotenv.config();
const TARGET = /egg testing light/i;

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('✅ Connected\n');

  const p: any = await Product.findOne({ name: TARGET }).select('name isActive inStock isAvailable isPrime').lean();
  console.log('Current DB state:', p ? { isActive: p.isActive, inStock: p.inStock, isAvailable: p.isAvailable } : 'NOT FOUND', '\n');

  // Customer storefront listing (shuffle, page 1, 24/page — like the app)
  ProductService.clearListingCache();
  const seeded = await ProductService.getAllProducts({ isActive: true, seed: 777, limit: 1000 });
  const idxSeeded = seeded.products.findIndex((x: any) => TARGET.test(x.name));
  console.log(`Storefront shuffle: total=${seeded.total}, position of TEST = ${idxSeeded} (page ${Math.floor(idxSeeded / 24) + 1} at 24/page)`);
  console.log(`On page 1? ${idxSeeded >= 0 && idxSeeded < 24}\n`);

  // Customer search for "egg" and "testing"
  for (const term of ['egg', 'testing', 'egg testing']) {
    ProductService.clearListingCache();
    const r = await ProductService.getAllProducts({ isActive: true, search: term, limit: 1000 });
    const found = r.products.some((x: any) => TARGET.test(x.name));
    console.log(`Search "${term}": ${r.total} results, TEST found = ${found}`);
  }

  await mongoose.disconnect();
  console.log('\n🔌 Disconnected');
}
run().catch((e) => { console.error(e); process.exit(1); });
