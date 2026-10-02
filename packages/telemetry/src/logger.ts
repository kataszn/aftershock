import { pino, type Logger, type LoggerOptions } from 'pino';

export type { Logger };

export type CreateLoggerOptions = {
  /** Logical service name, attached to every line as `service`. */
  service: string;
  /** Overrides LOG_LEVEL / NODE_ENV-derived default. */
  level?: string;
};

/**
 * Builds a pino logger.
 *
 * Always emits newline-delimited JSON — the format CloudWatch Logs Insights
 * expects, where every field is queryable without a parser. In development the
 * `dev` script pipes stdout through `pino-colada` for human-readable output,
 * so the logger itself never needs a pretty transport (and nothing extra is
 * pulled into the production bundle).
 */
export function createLogger({ service, level }: CreateLoggerOptions): Logger {
  const isProd = process.env.NODE_ENV === 'production';

  const options: LoggerOptions = {
    level: level ?? process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: 'msg',
    formatters: {
      level: (label) => ({ level: label }),
    },
    // Never let credentials or webhook secrets reach the log stream.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.secret',
        '*.password',
        '*.token',
        'secret',
      ],
      remove: true,
    },
  };

  return pino(options);
}
