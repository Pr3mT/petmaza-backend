import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixDecimalPrices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db!;
    const collection = db.collection('products');

    // Find all products that have decimal prices
    const products = await collection.find({}).toArray();

    let fixedCount = 0;
    let skippedCount = 0;

    for (const product of products) {
      const updates: any = {};
      let needsUpdate = false;

      // Fix top-level prices
      if (typeof product.mrp === 'number' && !Number.isInteger(product.mrp)) {
        updates.mrp = Math.round(product.mrp);
        needsUpdate = true;
      }
      if (typeof product.sellingPrice === 'number' && !Number.isInteger(product.sellingPrice)) {
        updates.sellingPrice = Math.round(product.sellingPrice);
        needsUpdate = true;
      }
      if (typeof product.purchasePrice === 'number' && !Number.isInteger(product.purchasePrice)) {
        updates.purchasePrice = Math.round(product.purchasePrice);
        needsUpdate = true;
      }

      // Recalculate discount from rounded prices
      const mrp = updates.mrp ?? product.mrp;
      const sp = updates.sellingPrice ?? product.sellingPrice;
      if (mrp && sp) {
        const correctDiscount = Math.round(((mrp - sp) / mrp) * 100);
        if (product.discount !== correctDiscount) {
          updates.discount = correctDiscount;
          needsUpdate = true;
        }
      }

      // Fix variant prices
      if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
        const fixedVariants = product.variants.map((v: any) => {
          let changed = false;
          const fv = { ...v };

          if (typeof fv.mrp === 'number' && !Number.isInteger(fv.mrp)) {
            fv.mrp = Math.round(fv.mrp);
            changed = true;
          }
          if (typeof fv.sellingPrice === 'number' && !Number.isInteger(fv.sellingPrice)) {
            fv.sellingPrice = Math.round(fv.sellingPrice);
            changed = true;
          }
          if (typeof fv.purchasePrice === 'number' && !Number.isInteger(fv.purchasePrice)) {
            fv.purchasePrice = Math.round(fv.purchasePrice);
            changed = true;
          }

          // Recalculate variant discount
          if (fv.mrp && fv.sellingPrice) {
            const correctDiscount = Math.round(((fv.mrp - fv.sellingPrice) / fv.mrp) * 100);
            if (fv.discount !== correctDiscount) {
              fv.discount = correctDiscount;
              changed = true;
            }
          }

          if (changed) needsUpdate = true;
          return fv;
        });

        if (needsUpdate) {
          updates.variants = fixedVariants;
        }
      }

      if (needsUpdate) {
        await collection.updateOne(
          { _id: product._id },
          { $set: updates }
        );
        console.log(`Fixed: "${product.name}" (${product._id})`);
        if (updates.mrp !== undefined) console.log(`  mrp: ${product.mrp} → ${updates.mrp}`);
        if (updates.sellingPrice !== undefined) console.log(`  sellingPrice: ${product.sellingPrice} → ${updates.sellingPrice}`);
        if (updates.purchasePrice !== undefined) console.log(`  purchasePrice: ${product.purchasePrice} → ${updates.purchasePrice}`);
        if (updates.discount !== undefined) console.log(`  discount: ${product.discount} → ${updates.discount}`);
        if (updates.variants) {
          updates.variants.forEach((v: any, i: number) => {
            const orig = product.variants[i];
            if (orig.sellingPrice !== v.sellingPrice) console.log(`  variant[${i}] sellingPrice: ${orig.sellingPrice} → ${v.sellingPrice}`);
            if (orig.mrp !== v.mrp) console.log(`  variant[${i}] mrp: ${orig.mrp} → ${v.mrp}`);
            if (orig.purchasePrice !== v.purchasePrice) console.log(`  variant[${i}] purchasePrice: ${orig.purchasePrice} → ${v.purchasePrice}`);
          });
        }
        fixedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`\n✅ Done! Fixed ${fixedCount} products, skipped ${skippedCount} (already clean).`);
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixDecimalPrices();
