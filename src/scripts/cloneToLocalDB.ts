import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URI = 'mongodb+srv://RivrTechlabs:RivrTech%402100@rivrcluster.k62al.mongodb.net';
const SOURCE_DB = 'pet-marketplace';
const TARGET_DB = 'petmaza-local';

async function cloneToLocalDB() {
  console.log('=== Clone pet-marketplace → petmaza-local (same Atlas cluster) ===\n');

  const sourceConn = await mongoose
    .createConnection(`${BASE_URI}/${SOURCE_DB}?appName=RIVRCluster`)
    .asPromise();
  console.log(`Connected to source: ${SOURCE_DB}`);

  const targetConn = await mongoose
    .createConnection(`${BASE_URI}/${TARGET_DB}?appName=RIVRCluster`)
    .asPromise();
  console.log(`Connected to target: ${TARGET_DB}\n`);

  const collections = await sourceConn.db!.listCollections().toArray();
  console.log(`Found ${collections.length} collections to clone:\n`);

  let totalDocs = 0;

  for (const { name } of collections) {
    const src = sourceConn.collection(name);
    const tgt = targetConn.collection(name);

    const docs = await src.find({}).toArray();
    if (docs.length === 0) {
      console.log(`  ${name}: (empty, skipped)`);
      continue;
    }

    await tgt.deleteMany({});
    await tgt.insertMany(docs, { ordered: false });
    console.log(`  ${name}: ${docs.length} documents`);
    totalDocs += docs.length;
  }

  console.log(`\nDone! Cloned ${totalDocs} documents across ${collections.length} collections.`);
  console.log(`\nDatabase "petmaza-local" is ready on your Atlas cluster.`);

  await sourceConn.close();
  await targetConn.close();
  process.exit(0);
}

cloneToLocalDB().catch((err) => {
  console.error('Clone failed:', err.message);
  process.exit(1);
});
