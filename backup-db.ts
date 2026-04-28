/**
 * backup-db.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CLI entry point for manual / one-off database backups.
 *
 * Usage:
 *   npx ts-node backup-db.ts
 *   npm run backup
 *
 * The script connects to MongoDB using MONGODB_URI from .env, runs a full
 * export of every collection, then disconnects and exits cleanly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { runBackup } from './src/services/backupService';

dotenv.config();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[Backup] ✖  MONGODB_URI is not set in .env — aborting.');
    process.exit(1);
  }

  console.log('[Backup] Connecting to MongoDB…');
  await mongoose.connect(uri);
  console.log('[Backup] Connected.\n');

  const result = await runBackup();

  // Print a human-readable summary to the console
  console.log('\n══════════════════════════════════════════════');
  console.log(`  Status    : ${result.success ? '✔  SUCCESS' : '✖  PARTIAL FAILURE'}`);
  console.log(`  Folder    : ${result.backupDir}`);
  console.log(`  Timestamp : ${result.timestamp}`);
  console.log(`  Documents : ${result.totalDocuments}`);
  console.log(`  Size      : ${(result.totalSizeBytes / 1024).toFixed(1)} KB`);
  console.log(`  Duration  : ${result.durationMs} ms`);
  console.log('──────────────────────────────────────────────');

  // Per-collection table
  console.log('  Collection                      Docs     Size');
  for (const col of result.collections) {
    const status   = col.success ? '✔' : '✖';
    const name     = col.name.padEnd(32);
    const docs     = String(col.documentCount).padStart(6);
    const sizeKB   = (col.fileSizeBytes / 1024).toFixed(1).padStart(8) + ' KB';
    const errInfo  = col.error ? `  ← ERROR: ${col.error}` : '';
    console.log(`  ${status} ${name} ${docs}   ${sizeKB}${errInfo}`);
  }

  console.log('══════════════════════════════════════════════\n');

  await mongoose.disconnect();
  console.log('[Backup] Done. MongoDB disconnected.');
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error('[Backup] Fatal error:', err);
  process.exit(1);
});
