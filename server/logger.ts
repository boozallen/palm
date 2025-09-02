import winston from 'winston';

import { getConfig } from '@/server/config';

export function createLogger() {
  let config = getConfig();
  return winston.createLogger({
    level: getLogLevel(config.logLevel, config.nodeEnv),
    format: getLogFormat(config.logFormat),
    transports: [new winston.transports.Console()],
  });
}

export const logger = createLogger();
export type Logger = typeof logger;
export default logger;

function getLogLevel(logLevel: string | undefined, nodeEnv: string | undefined) {
  const valid = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
  const fallback = nodeEnv === 'development' ? 'debug' : 'info';
  if (logLevel) {
    if (valid.includes(logLevel)) {
      return logLevel;
    }
    console.warn(`Invalid LOG_LEVEL="${logLevel}", falling back to ${fallback}`);
  }
  return fallback;
}

function getLogFormat(logFormat: string | undefined) {
  const { combine, timestamp, json, prettyPrint } = winston.format;
  return combine(
    timestamp(),
    logFormat === 'prettyPrint' ? prettyPrint() : json(),
  );
}
