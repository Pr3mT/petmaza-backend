/**
 * Manual trigger for the memory-safe streaming DB backup + email.
 * Same code path as the daily 2 AM cron. Run any time with:
 *   npx ts-node --transpile-only src/scripts/runBackupNow.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { runStreamingBackupAndEmail } from '../services/backupService';

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const before = process.memoryUsage().heapUsed;
  const result = await runStreamingBackupAndEmail();
  const peak = process.memoryUsage().heapUsed;
  console.log('\nResult:', JSON.stringify({ success: result.success, fileName: result.fileName, sizeKB: +(result.fileSizeBytes / 1024).toFixed(1), totalDocuments: result.totalDocuments, durationMs: result.durationMs, error: result.error }, null, 2));
  console.log(`Heap delta during backup: ${((peak - before) / 1024 / 1024).toFixed(1)} MB`);
  // Let the fire-and-forget EmailLog write finish before closing the connection.
  await new Promise((r) => setTimeout(r, 1500));
  await mongoose.connection.close();
  process.exit(result.success ? 0 : 1);
};

run().catch((e) => { console.error(e); process.exit(1); });
