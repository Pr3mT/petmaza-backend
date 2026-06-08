/* Equivalence check: old in-JS effectiveInStock vs new DB aggregation.
 * Asserts both classify every product identically on the live data. */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI!);

  // OLD logic (pull variants, compute in JS)
  const docs: any[] = await Product.find({}).select('_id isActive inStock hasVariants variants').lean();
  const oldInStock = new Set<string>();
  for (const doc of docs) {
    let eff: boolean;
    if (doc.hasVariants && doc.variants && doc.variants.length > 0) {
      eff = doc.isActive !== false && doc.inStock !== false && doc.variants.some((v: any) => v.isActive !== false);
    } else {
      eff = doc.isActive !== false && doc.inStock !== false;
    }
    if (eff) oldInStock.add(String(doc._id));
  }

  // NEW logic (DB aggregation)
  const agg: any[] = await Product.aggregate([
    { $match: {} },
    { $project: { _id: 1, effectiveInStock: { $and: [
      { $ne: ['$isActive', false] },
      { $ne: ['$inStock', false] },
      { $cond: [
        { $and: [{ $eq: ['$hasVariants', true] }, { $isArray: '$variants' }, { $gt: [{ $size: { $ifNull: ['$variants', []] } }, 0] }] },
        { $anyElementTrue: { $map: { input: '$variants', as: 'v', in: { $ne: ['$$v.isActive', false] } } } },
        true,
      ] },
    ] } } },
  ]);
  const newInStock = new Set<string>(agg.filter((d) => d.effectiveInStock).map((d) => String(d._id)));

  const total = docs.length;
  const onlyOld = [...oldInStock].filter((id) => !newInStock.has(id));
  const onlyNew = [...newInStock].filter((id) => !oldInStock.has(id));

  console.log(`Total products: ${total}`);
  console.log(`OLD in-stock: ${oldInStock.size} | NEW in-stock: ${newInStock.size}`);
  console.log(`Mismatches → only OLD: ${onlyOld.length}, only NEW: ${onlyNew.length}`);
  if (onlyOld.length || onlyNew.length) {
    console.log('❌ NOT EQUIVALENT');
    console.log('onlyOld sample:', onlyOld.slice(0, 5));
    console.log('onlyNew sample:', onlyNew.slice(0, 5));
  } else {
    console.log('✅ EQUIVALENT — DB aggregation matches old JS logic exactly.');
  }

  await mongoose.connection.close();
  process.exit(onlyOld.length || onlyNew.length ? 1 : 0);
};

run().catch((e) => { console.error(e); process.exit(1); });
