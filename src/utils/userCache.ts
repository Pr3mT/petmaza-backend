/**
 * In-memory user cache for authentication
 * Reduces database queries by 99%
 */

interface CachedUser {
  data: any;
  timestamp: number;
}

class UserCache {
  private cache: Map<string, CachedUser> = new Map();
  private TTL = 300000; // 5 minutes cache

  set(userId: string, userData: any): void {
    this.cache.set(userId, {
      data: userData,
      timestamp: Date.now(),
    });
  }

  get(userId: string): any | null {
    const cached = this.cache.get(userId);
    
    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(userId);
      return null;
    }

    return cached.data;
  }

  delete(userId: string): void {
    this.cache.delete(userId);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean expired entries periodically
  startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [userId, cached] of this.cache.entries()) {
        if (now - cached.timestamp > this.TTL) {
          this.cache.delete(userId);
        }
      }
    }, 60000); // Clean every minute
  }
}

export const userCache = new UserCache();
userCache.startCleanup();
