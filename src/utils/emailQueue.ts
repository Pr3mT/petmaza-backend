import logger from '../config/logger';

interface EmailJob {
  id: string;
  fn: () => Promise<void>;
  retries: number;
  maxRetries: number;
  addedAt: Date;
}

/**
 * In-memory email queue for async processing
 * Prevents email sending from blocking HTTP responses
 */
class EmailQueue {
  private queue: EmailJob[] = [];
  private processing: boolean = false;
  private readonly maxRetries = 3;
  private readonly processingInterval = 100; // Process every 100ms
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.startProcessing();
  }

  /**
   * Add email job to queue (non-blocking)
   */
  add(fn: () => Promise<void>): string {
    const jobId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: EmailJob = {
      id: jobId,
      fn,
      retries: 0,
      maxRetries: this.maxRetries,
      addedAt: new Date(),
    };

    this.queue.push(job);
    logger.info(`[EmailQueue] Job ${jobId} added to queue. Queue size: ${this.queue.length}`);
    
    return jobId;
  }

  /**
   * Start background processing
   */
  private startProcessing(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(async () => {
      if (this.processing || this.queue.length === 0) return;

      this.processing = true;
      const job = this.queue.shift();

      if (job) {
        try {
          await job.fn();
          logger.info(`[EmailQueue] Job ${job.id} completed successfully`);
        } catch (error: any) {
          job.retries++;
          
          if (job.retries < job.maxRetries) {
            // Re-queue for retry
            this.queue.push(job);
            logger.warn(`[EmailQueue] Job ${job.id} failed, retry ${job.retries}/${job.maxRetries}: ${error.message}`);
          } else {
            logger.error(`[EmailQueue] Job ${job.id} failed after ${job.maxRetries} retries: ${error.message}`);
          }
        }
      }

      this.processing = false;
    }, this.processingInterval);

    logger.info('[EmailQueue] Background processing started');
  }

  /**
   * Stop background processing (for graceful shutdown)
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info('[EmailQueue] Background processing stopped');
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
    };
  }

  /**
   * Clear all pending jobs (use with caution)
   */
  clear(): void {
    this.queue = [];
    logger.warn('[EmailQueue] Queue cleared');
  }
}

// Singleton instance
export const emailQueue = new EmailQueue();

// Graceful shutdown
process.on('SIGTERM', () => {
  emailQueue.stop();
});

process.on('SIGINT', () => {
  emailQueue.stop();
});
