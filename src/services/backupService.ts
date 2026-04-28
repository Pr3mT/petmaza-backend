/**
 * backupService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Auto-backup service for the Petmaza MongoDB database.
 *
 * What it does:
 *  • Exports EVERY collection in the database to a JSON file
 *  • Organises backups in  backups/YYYY-MM-DD_HH-MM-SS/
 *  • Writes a manifest.json summary (collections backed up, doc counts, size)
 *  • Automatically deletes backups older than MAX_BACKUP_AGE_DAYS (default 30)
 *  • Returns a detailed result object so callers can log / alert on failure
 *
 * Scheduled by server.ts using node-cron (runs daily at 02:00 AM by default).
 * Can also be triggered manually via:  npx ts-node backup-db.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import logger from '../config/logger';

// ── Config ───────────────────────────────────────────────────────────────────

// Root folder where all backups are stored (next to src/)
const BACKUP_ROOT = path.join(__dirname, '../../backups');

// How many days of backups to keep before auto-deleting old ones
const MAX_BACKUP_AGE_DAYS = Number(process.env.BACKUP_RETENTION_DAYS) || 30;

// Collections to skip (system / large-log tables that don't need daily backup)
const SKIP_COLLECTIONS: string[] = [];

// ── Types ────────────────────────────────────────────────────────────────────

export interface CollectionResult {
  name: string;
  documentCount: number;
  fileSizeBytes: number;
  success: boolean;
  error?: string;
}

export interface BackupResult {
  success: boolean;
  backupDir: string;
  timestamp: string;
  collections: CollectionResult[];
  totalDocuments: number;
  totalSizeBytes: number;
  durationMs: number;
  error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats a Date into a filesystem-safe string: 2026-04-28_02-00-00
 */
function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
}

/**
 * Returns the size of a file in bytes (0 if it doesn't exist).
 */
function fileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

/**
 * Removes backup folders older than MAX_BACKUP_AGE_DAYS.
 */
function pruneOldBackups(): void {
  if (!fs.existsSync(BACKUP_ROOT)) return;

  const cutoff = Date.now() - MAX_BACKUP_AGE_DAYS * 24 * 60 * 60 * 1000;

  const entries = fs.readdirSync(BACKUP_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const fullPath = path.join(BACKUP_ROOT, entry.name);
    const stat = fs.statSync(fullPath);

    // Use folder creation time (birthtime) to decide age
    if (stat.birthtimeMs < cutoff) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      logger.info(`[Backup] Pruned old backup: ${entry.name}`);
    }
  }
}

// ── Core export function ─────────────────────────────────────────────────────

/**
 * Runs a full database export.
 *
 * @param db  - Active Mongoose connection db (uses mongoose.connection.db by default)
 * @returns   BackupResult with per-collection stats
 */
export async function runBackup(db?: mongoose.mongo.Db): Promise<BackupResult> {
  const start = Date.now();
  const timestamp = formatTimestamp(new Date());
  const backupDir = path.join(BACKUP_ROOT, timestamp);

  // Ensure backup directory exists
  fs.mkdirSync(backupDir, { recursive: true });

  const targetDb: mongoose.mongo.Db = db || (mongoose.connection.db as mongoose.mongo.Db);

  if (!targetDb) {
    return {
      success: false,
      backupDir,
      timestamp,
      collections: [],
      totalDocuments: 0,
      totalSizeBytes: 0,
      durationMs: Date.now() - start,
      error: 'No active MongoDB connection.',
    };
  }

  // Discover all collections dynamically — backs up EVERYTHING automatically
  const collectionInfos = await targetDb.listCollections().toArray();
  const collectionNames = collectionInfos
    .map((c) => c.name)
    .filter((name) => !SKIP_COLLECTIONS.includes(name))
    .sort();

  logger.info(`[Backup] Starting backup of ${collectionNames.length} collections → ${backupDir}`);

  const results: CollectionResult[] = [];

  for (const collName of collectionNames) {
    const filePath = path.join(backupDir, `${collName}.json`);
    let success = false;
    let documentCount = 0;
    let errorMsg: string | undefined;

    try {
      // Stream all documents from the collection
      const docs = await targetDb.collection(collName).find({}).toArray();
      documentCount = docs.length;

      // Write as pretty-printed JSON for easy manual inspection / import
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');
      success = true;
    } catch (err: any) {
      errorMsg = err?.message || String(err);
      logger.error(`[Backup] Failed to back up ${collName}: ${errorMsg}`);
    }

    results.push({
      name: collName,
      documentCount,
      fileSizeBytes: fileSize(filePath),
      success,
      error: errorMsg,
    });
  }

  // Write manifest summary
  const totalDocuments = results.reduce((sum, r) => sum + r.documentCount, 0);
  const totalSizeBytes = results.reduce((sum, r) => sum + r.fileSizeBytes, 0);
  const durationMs = Date.now() - start;

  const manifest = {
    timestamp,
    databaseName: targetDb.databaseName,
    collections: results,
    totalCollections: results.length,
    totalDocuments,
    totalSizeBytes,
    totalSizeMB: (totalSizeBytes / 1024 / 1024).toFixed(2),
    durationMs,
    retentionDays: MAX_BACKUP_AGE_DAYS,
  };

  fs.writeFileSync(
    path.join(backupDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  // Clean up backups beyond retention window
  pruneOldBackups();

  const failed = results.filter((r) => !r.success);
  const overallSuccess = failed.length === 0;

  if (overallSuccess) {
    logger.info(
      `[Backup] ✔ Complete — ${totalDocuments} docs across ${results.length} collections` +
      ` | ${(totalSizeBytes / 1024).toFixed(1)} KB | ${durationMs}ms`
    );
  } else {
    logger.warn(
      `[Backup] ⚠ Finished with ${failed.length} failed collection(s): ` +
      failed.map((r) => r.name).join(', ')
    );
  }

  return {
    success: overallSuccess,
    backupDir,
    timestamp,
    collections: results,
    totalDocuments,
    totalSizeBytes,
    durationMs,
  };
}
