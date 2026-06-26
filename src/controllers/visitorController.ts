import { Request, Response, NextFunction } from 'express';
import VisitorStat from '../models/VisitorStat';

// Today's date as YYYY-MM-DD in IST (en-CA locale formats as ISO)
const istDate = (offsetDays = 0): string => {
  const d = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

// ── In-memory batching ───────────────────────────────────────────────────────
// Each visit ping only increments a counter in RAM (zero DB work per request).
// A timer flushes pending counts to MongoDB once a minute as a single upsert,
// so even a traffic spike costs the server one tiny write per minute.
// Trade-off: up to 60s of counts can be lost on a restart — fine for stats.
const pendingVisits = new Map<string, number>();

const flushVisits = async (): Promise<void> => {
  if (pendingVisits.size === 0) return;
  const entries = Array.from(pendingVisits.entries());
  pendingVisits.clear();
  try {
    await VisitorStat.bulkWrite(
      entries.map(([date, count]) => ({
        updateOne: {
          filter: { date },
          update: { $inc: { count } },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  } catch {
    // Best-effort: drop the batch rather than retry, so memory can't grow
  }
};

// unref() so this timer never keeps the process alive on shutdown
setInterval(flushVisits, 60 * 1000).unref();

// POST /api/visits — public, called at most once per visitor per day (frontend
// dedupes via localStorage). No body, no auth, responds immediately.
export const recordVisit = (_req: Request, res: Response): void => {
  const today = istDate();
  pendingVisits.set(today, (pendingVisits.get(today) || 0) + 1);
  res.status(204).end();
};

// GET /api/visits/stats?days=N — admin dashboard, daily counts for last N days
export const getVisitorStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days as string, 10) || 14, 1), 90);

    // Flush pending counts first so "today" is up to date on the dashboard
    await flushVisits();

    const startDate = istDate(days - 1);
    const rows = await VisitorStat.find({ date: { $gte: startDate } })
      .select('date count -_id')
      .lean();

    const countByDate = new Map(rows.map((r) => [r.date, r.count]));

    // Fill missing days with 0 so the chart has a continuous axis
    const daily: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = istDate(i);
      daily.push({ date, count: countByDate.get(date) || 0 });
    }

    res.status(200).json({
      success: true,
      data: {
        daily,
        today: daily[daily.length - 1]?.count || 0,
        total: daily.reduce((sum, d) => sum + d.count, 0),
      },
    });
  } catch (error) {
    next(error);
  }
};
