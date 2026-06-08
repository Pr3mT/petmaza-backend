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
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import logger from '../config/logger';
import { sendEmail } from './emailer';

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

// ── Memory-safe streaming backup (for the in-process daily cron) ──────────────
// Unlike runBackup() (which .toArray()s every collection into RAM — fine for the
// local CLI, dangerous on a memory-bound server), this streams documents ONE AT
// A TIME through a gzip pipe to a single temp file. Memory stays bounded by the
// cursor batch size regardless of DB size. Output: <tmp>/petmaza-backup-<ts>.ndjson.gz
// (newline-delimited JSON; each collection preceded by a {"__collection__":…} line).

const MAX_EMAIL_ATTACHMENT_BYTES = 12 * 1024 * 1024; // ZeptoMail/Gmail-safe ceiling

export interface StreamBackupResult {
  success: boolean;
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  totalDocuments: number;
  collections: { name: string; documentCount: number }[];
  durationMs: number;
  error?: string;
}

export async function runStreamingBackup(db?: mongoose.mongo.Db): Promise<StreamBackupResult> {
  const start = Date.now();
  const timestamp = formatTimestamp(new Date());
  const fileName = `petmaza-backup-${timestamp}.ndjson.gz`;
  const filePath = path.join(os.tmpdir(), fileName);

  const targetDb: mongoose.mongo.Db = db || (mongoose.connection.db as mongoose.mongo.Db);
  if (!targetDb) {
    return { success: false, filePath, fileName, fileSizeBytes: 0, totalDocuments: 0, collections: [], durationMs: Date.now() - start, error: 'No active MongoDB connection.' };
  }

  const gzip = zlib.createGzip();
  const out = fs.createWriteStream(filePath);
  gzip.pipe(out);

  let streamErr: Error | null = null;
  gzip.on('error', (e) => { streamErr = e; });
  out.on('error', (e) => { streamErr = e; });

  // Write with backpressure — never buffer more than one chunk past the high-water mark.
  const write = (s: string) => new Promise<void>((resolve) => {
    if (streamErr) return resolve();
    if (gzip.write(s)) resolve();
    else gzip.once('drain', () => resolve());
  });

  const collections: { name: string; documentCount: number }[] = [];
  let totalDocuments = 0;

  try {
    const infos = await targetDb.listCollections().toArray();
    const names = infos.map((c) => c.name).filter((n) => !SKIP_COLLECTIONS.includes(n)).sort();

    for (const name of names) {
      if (streamErr) throw streamErr;
      await write(JSON.stringify({ __collection__: name }) + '\n');
      const cursor = targetDb.collection(name).find({}).batchSize(500);
      let n = 0;
      for await (const doc of cursor) {
        await write(JSON.stringify(doc) + '\n');
        n++;
      }
      collections.push({ name, documentCount: n });
      totalDocuments += n;
    }

    await new Promise<void>((resolve, reject) => {
      out.on('finish', () => resolve());
      out.on('error', reject);
      gzip.end();
    });
    if (streamErr) throw streamErr;

    const fileSizeBytes = fileSize(filePath);
    logger.info(`[Backup] ✔ Streaming backup — ${totalDocuments} docs, ${(fileSizeBytes / 1024).toFixed(1)} KB gz, ${Date.now() - start}ms → ${filePath}`);
    return { success: true, filePath, fileName, fileSizeBytes, totalDocuments, collections, durationMs: Date.now() - start };
  } catch (err: any) {
    gzip.destroy();
    out.destroy();
    const msg = err?.message || String(err);
    logger.error(`[Backup] ✖ Streaming backup failed: ${msg}`);
    return { success: false, filePath, fileName, fileSizeBytes: fileSize(filePath), totalDocuments, collections, durationMs: Date.now() - start, error: msg };
  }
}

// Runs the streaming backup and emails the gzip archive to ADMIN_EMAILS.
// Always deletes the temp file afterwards (server /tmp is ephemeral anyway).
export async function runStreamingBackupAndEmail(db?: mongoose.mongo.Db): Promise<StreamBackupResult> {
  const result = await runStreamingBackup(db);

  const recipients = (process.env.ADMIN_EMAILS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);

  if (!recipients.length) {
    logger.warn('[Backup] ADMIN_EMAILS not set — skipping backup email.');
    safeUnlink(result.filePath);
    return result;
  }

  const sizeKB = (result.fileSizeBytes / 1024).toFixed(1);
  const rows = result.collections
    .map((c) => `<tr><td style="padding:2px 10px;">${c.name}</td><td style="padding:2px 10px;text-align:right;">${c.documentCount}</td></tr>`)
    .join('');
  const tooBig = result.fileSizeBytes > MAX_EMAIL_ATTACHMENT_BYTES;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:${result.success ? '#2e7d32' : '#c62828'};">PETMAZA Daily DB Backup ${result.success ? '✔' : '✖'}</h2>
      <p>Date: <strong>${result.fileName}</strong></p>
      <p>Total documents: <strong>${result.totalDocuments}</strong> across ${result.collections.length} collections<br>
         Archive size: <strong>${sizeKB} KB</strong> (gzip) &middot; Duration: ${result.durationMs} ms</p>
      ${result.error ? `<p style="color:#c62828;">Error: ${result.error}</p>` : ''}
      ${tooBig ? `<p style="color:#b45309;">⚠ Archive exceeds the ${(MAX_EMAIL_ATTACHMENT_BYTES / 1024 / 1024)}MB email limit — not attached. Configure off-box storage (e.g. S3) for backups this large.</p>` : ''}
      <table style="border-collapse:collapse;font-size:13px;margin-top:10px;"><thead><tr><th style="text-align:left;padding:2px 10px;">Collection</th><th style="text-align:right;padding:2px 10px;">Docs</th></tr></thead><tbody>${rows}</tbody></table>
      <p style="color:#999;font-size:12px;margin-top:16px;">Restore: gunzip the file → newline-delimited JSON; each collection starts with a {"__collection__":"name"} marker line.</p>
    </div>`;

  try {
    let attachments;
    if (result.success && !tooBig && result.fileSizeBytes > 0) {
      attachments = [{
        filename: result.fileName,
        content: fs.readFileSync(result.filePath), // small gzip — safe to read for the attachment
        contentType: 'application/gzip',
      }];
    }
    await sendEmail({
      to: recipients[0],
      cc: recipients.slice(1),
      subject: `PETMAZA DB Backup ${result.success ? '' : '(FAILED) '}— ${result.fileName}`,
      html,
      trigger: 'daily_db_backup',
      attachments,
    });
    logger.info(`[Backup] Backup email sent to ${recipients.join(', ')}${attachments ? ' with attachment' : ' (no attachment)'}`);
  } catch (err: any) {
    logger.error(`[Backup] Failed to email backup: ${err?.message || err}`);
  } finally {
    safeUnlink(result.filePath);
  }

  return result;
}

function safeUnlink(p: string): void {
  try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
}
