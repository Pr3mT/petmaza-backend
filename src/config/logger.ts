import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'pet-marketplace-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    // Console transport in ALL environments. Production hosts (Render) capture
    // stdout — without this, logs only hit the ephemeral logs/*.log files and
    // are invisible in the dashboard. Prod uses the base JSON format (structured,
    // one object per line); dev uses a readable colorized line.
    new winston.transports.Console(
      process.env.NODE_ENV === 'production'
        ? {}
        : {
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            ),
          }
    ),
  ],
});

export default logger;

