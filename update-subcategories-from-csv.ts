import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// CSV data: [product_name, sub_category]
const csvData: { name: string; subCategory: string }[] = [
  { name: 'PAW PRINTED CAT COLLAR', subCategory: 'Cat Accessories' },
  { name: 'BURAQ CAT COLLAR', subCategory: 'Cat Accessories' },
  { name: 'REFLECTIVE CAT COLLAR', subCategory: 'Cat Accessories' },
  { name: 'IMPORTED CAT COLLAR JEANS & BONES', subCategory: 'Cat Accessories' },
  { name: 'CAT GLITTER COLLAR', subCategory: 'Cat Accessories' },
  { name: 'IMPORTED CAT COLLAR STRIP DESIGN', subCategory: 'Cat Accessories' },
  { name: 'IMPORTED CAT COLLAR DOTTED', subCategory: 'Cat Accessories' },
  { name: 'ULTRA SOFT COLLAR', subCategory: 'Cat Accessories' },
  { name: 'ULTRA SOFT BUNNY COLLAR', subCategory: 'Cat Accessories' },
  { name: 'BREAKAWAY CAT COLLAR', subCategory: 'Cat Accessories' },
  { name: 'CAT FANCY COLLAR', subCategory: 'Cat Accessories' },
  { name: 'SILICONE CAT COLLAR', subCategory: 'Cat Accessories' },
  { name: 'BOW CAT COLLAR', subCategory: 'Cat Accessories' },
  { name: 'RADIUM CAT COLLAR', subCategory: 'Cat Accessories' },
  { name: 'CAT TEASING COLLAR TOYNESS', subCategory: 'Cat Accessories' },
  { name: 'CAT & DOG TIE', subCategory: 'Cat Accessories' },
  { name: 'PLAIN CAT HARNESS BODY SET', subCategory: 'Cat Accessories' },
  { name: 'REFLECTIVE CAT HARNESS BODY SET', subCategory: 'Cat Accessories' },
  { name: 'PLAIN COLLAR + LEASH', subCategory: 'Cat Accessories' },
  { name: 'REFLECTIVE COLLAR + LEASH', subCategory: 'Cat Accessories' },
  { name: 'PRINTED CAT BODY HARNESS', subCategory: 'Cat Accessories' },
  { name: 'BUTTERFLY CAT HARNESS', subCategory: 'Cat Accessories' },
  { name: 'CAT NO PULL HARNESS (XXS)', subCategory: 'Cat Accessories' },
  { name: 'CAT NO PULL HARNESS (XS)', subCategory: 'Cat Accessories' },
  { name: 'CAT NO PULL HARNESS (S)', subCategory: 'Cat Accessories' },
  { name: 'CAT NO PULL HARNESS (M)', subCategory: 'Cat Accessories' },
  { name: 'CAT & DOG SUN GLASSES', subCategory: 'Cat Accessories' },
  { name: 'DOG GOGGLES', subCategory: 'Dog Accessories' },
  { name: 'MULTI COLOR BELLS CARD (SET OF 18)', subCategory: 'Cat Accessories' },
  { name: 'ROUND BELL BIG CARD (SET OF 18)', subCategory: 'Cat Accessories' },
  { name: 'CARTOON SOUND BELL CARD (SET OF 18)', subCategory: 'Cat Accessories' },
  { name: 'REFLECTIVE DOG COLLAR', subCategory: 'Dog Accessories' },
  { name: 'MAX REFLECTIVE DOG COLLAR', subCategory: 'Dog Accessories' },
  { name: '3M REFLECTOR WATER PROOF DOG COLLAR', subCategory: 'Dog Accessories' },
  { name: 'TITAN REFLECTIVE COLLAR PRO', subCategory: 'Dog Accessories' },
  { name: 'IMPORTED DOG COLLAR', subCategory: 'Dog Accessories' },
  { name: 'ECONOMIC DOG REFLECTIVE COLLAR', subCategory: 'Dog Accessories' },
  { name: 'NYLON SNAP DOG COLLAR', subCategory: 'Dog Accessories' },
  { name: 'NYLON REFLECTIVE DOG COLLAR', subCategory: 'Dog Accessories' },
  { name: 'ZIG ZAG DOG COLLAR', subCategory: 'Dog Accessories' },
  { name: 'TACTICAL DOG COLLAR', subCategory: 'Dog Accessories' },
  { name: 'TACTICAL DOG COLLAR HEAVY DUTY (S)', subCategory: 'Dog Accessories' },
  { name: 'NEO-PADDED REFLECTIVE DOG COLLAR', subCategory: 'Dog Accessories' },
  { name: 'PREMIUM SOFT PADDED COLLAR', subCategory: 'Dog Accessories' },
  { name: 'PUPPY REFLECTOR COLLAR', subCategory: 'Dog Accessories' },
  { name: 'DOG BOW COLLAR', subCategory: 'Dog Accessories' },
  { name: 'PUPPY COLLAR LITE', subCategory: 'Dog Accessories' },
  { name: 'GOAT COW REFLECTIVE COLLAR', subCategory: 'Small Animal Accessories' },
  { name: 'DOG VEST HARNESS (S)', subCategory: 'Dog Accessories' },
  { name: 'POLICE K9 HARNESS (S)', subCategory: 'Dog Accessories' },
  { name: 'K9 TACTICAL HARNESS (S)', subCategory: 'Dog Accessories' },
  { name: 'PREMIUM HARNESS (S)', subCategory: 'Dog Accessories' },
  { name: 'PREMIUM TACTICAL DOG HARNESS (S)', subCategory: 'Dog Accessories' },
  { name: 'IMPORTED PADDED BRAIDED LEASH', subCategory: 'Dog Accessories' },
  { name: 'LEASH WITH CHAIN', subCategory: 'Dog Accessories' },
  { name: 'CHAIN LEASH (S)', subCategory: 'Dog Accessories' },
  { name: 'RETRACTABLE LEASH (S-3 MTR)', subCategory: 'Dog Accessories' },
  { name: 'DOUBLE HANDLE REFLECTIVE DOG LEASH', subCategory: 'Dog Accessories' },
  { name: 'NYLON DOG LEASH', subCategory: 'Dog Accessories' },
  { name: 'ZIG-ZAG DOG LEASH', subCategory: 'Dog Accessories' },
  { name: 'DUAL LEASH', subCategory: 'Dog Accessories' },
  { name: 'TACTICAL MILITARY GRADE DOG LEASH', subCategory: 'Dog Accessories' },
  { name: 'PET SHOES (S)', subCategory: 'Dog Accessories' },
  { name: 'REFLECTIVE SHOES (S)', subCategory: 'Dog Accessories' },
  { name: 'DOG SOCKS', subCategory: 'Dog Accessories' },
  { name: 'PET TRAINING CLICKER', subCategory: 'Dog Accessories' },
  { name: 'MUZZLES (No 7)', subCategory: 'Dog Accessories' },
  { name: 'SILICONE RUBBER MUZZLE (No 4)', subCategory: 'Dog Accessories' },
  { name: 'E COLLAR (SET 1 TO 7)', subCategory: 'Dog Accessories' },
  { name: 'FLEA COMB', subCategory: 'Dog Accessories' },
  { name: 'DOUBLE SIDE COMB', subCategory: 'Dog Accessories' },
  { name: 'SINGLE SIDE COMB', subCategory: 'Dog Accessories' },
  { name: 'CRYSTAL COMB DOUBLE SIDED', subCategory: 'Dog Accessories' },
  { name: 'MASSAGE COMB', subCategory: 'Dog Accessories' },
  { name: 'NAIL CUTTER WITH CLIPPER SMALL', subCategory: 'Dog Accessories' },
  { name: 'NAIL CUTTER WITH CLIPPER', subCategory: 'Dog Accessories' },
  { name: 'NAIL CLIPPER SCISSOR', subCategory: 'Dog Accessories' },
  { name: 'NAIL CUTTER PRO', subCategory: 'Dog Accessories' },
  { name: 'PET GROOMING SCISSOR', subCategory: 'Dog Accessories' },
  { name: 'PET TRIMMER SET', subCategory: 'Dog Accessories' },
  { name: 'DOG NAIL GRINDER', subCategory: 'Dog Accessories' },
  { name: 'PET HAIR REMOVER GLOVE', subCategory: 'Dog Accessories' },
  { name: 'SELF CLEANING HAIR REMOVER', subCategory: 'Dog Accessories' },
  { name: 'LINT ROLLER FOR PETS', subCategory: 'Dog Accessories' },
  { name: 'PET FUR REMOVER', subCategory: 'Dog Accessories' },
  { name: 'REGULAR ROLLER BRUSH', subCategory: 'Dog Accessories' },
  { name: 'STAINLESS STEEL BOWLS', subCategory: 'Dog Accessories' },
  { name: 'PRINTED BOWLS', subCategory: 'Dog Accessories' },
  { name: '2 IN 1 FOOD BOWL', subCategory: 'Dog Accessories' },
  { name: 'FOOD MEASURING CUP WITH BAG CLIP', subCategory: 'Dog Accessories' },
  { name: 'CAKE SHAPE BOWL', subCategory: 'Dog Accessories' },
  { name: 'BURAQ PET FOUNTAIN WATER DISPENSER', subCategory: 'Cat Accessories' },
  { name: 'BURAQ TRANSPARENT FOUNTAIN WATER FEEDER', subCategory: 'Cat Accessories' },
  { name: 'PET PUZZLE FEEDER TOY', subCategory: 'Dog Accessories' },
  { name: 'DUAL HEAVY DINNER BOWL', subCategory: 'Dog Accessories' },
  { name: 'FOOD & WATER BOWL', subCategory: 'Dog Accessories' },
  { name: 'SLOW FEEDER DOG BOWL', subCategory: 'Dog Accessories' },
  { name: 'ELEVATED CAT BOWL', subCategory: 'Cat Accessories' },
  { name: 'TOWER OF TRACKS', subCategory: 'Cat Accessories' },
  { name: 'FLICKING FISH', subCategory: 'Cat Accessories' },
  { name: 'CAGE MOUSE TOY', subCategory: 'Cat Accessories' },
  { name: 'CHEWING BONE 3 INCH', subCategory: 'Dog Food' },
  { name: 'WHITE STICK', subCategory: 'Dog Food' },
  { name: 'SPIRAL MUTTON MUNCHIES', subCategory: 'Dog Food' },
  { name: 'SPIRAL CHICKEN MUNCHIES', subCategory: 'Dog Food' },
  { name: 'NG-NEO LIGHT', subCategory: 'Fish Accessories' },
  { name: '4-WAY AIR PUMP', subCategory: 'Fish Accessories' },
  { name: 'AQUARIUM 1 FT MIX LIGHT', subCategory: 'Fish Accessories' },
  { name: 'ALGAE SCRAPER', subCategory: 'Fish Accessories' },
  { name: '30 INCH BIRD CAGE', subCategory: 'Bird Accessories' },
  { name: '30 INCH EXTENDABLE BIRD CAGE', subCategory: 'Bird Accessories' },
  { name: 'BURAQ BIRD BACKPACK', subCategory: 'Bird Accessories' },
];

async function updateSubcategories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db!;
    const collection = db.collection('products');

    let updated = 0;
    let notFound = 0;
    const notFoundNames: string[] = [];

    for (const entry of csvData) {
      // Case-insensitive exact name match
      const result = await collection.updateMany(
        { name: { $regex: `^${entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        { $set: { subCategory: entry.subCategory } }
      );

      if (result.matchedCount === 0) {
        notFound++;
        notFoundNames.push(entry.name);
        console.log(`  ⚠️  NOT FOUND: "${entry.name}"`);
      } else {
        console.log(`  ✅ Updated ${result.modifiedCount}/${result.matchedCount} doc(s): "${entry.name}" → ${entry.subCategory}`);
        updated += result.modifiedCount;
      }
    }

    console.log('\n========== SUMMARY ==========');
    console.log(`✅ Updated: ${updated} product(s)`);
    console.log(`⚠️  Not found in DB: ${notFound} product(s)`);
    if (notFoundNames.length > 0) {
      console.log('\nNot found list:');
      notFoundNames.forEach(n => console.log(`  - ${n}`));
    }

    await mongoose.connection.close();
    console.log('\nDone. Connection closed.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

updateSubcategories();
