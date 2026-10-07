import winston from 'winston';
import { createLogger } from './logger';
import { getConfig } from '@/server/config';

jest.mock('winston', () => ({
  createLogger: jest.fn(),
  format: {
    combine: jest.fn().mockReturnValue({}),
    timestamp: jest.fn(),
    json: jest.fn(),
    prettyPrint: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
  },
}));

jest.mock('@/server/config', () => ({
  getConfig: jest.fn().mockReturnValue({
    logLevel: undefined,
    logFormat: undefined,
  }),
}));

describe('Logger creation', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create logger with correct level and format in production', () => {
    (getConfig as jest.Mock).mockReturnValue({
      logLevel: 'info',
      logFormat: undefined,
      nodeEnv: 'production',
    });

    createLogger();
    expect(winston.createLogger).toHaveBeenCalledWith({
      level: 'info',
      format: expect.anything(),
      transports: [expect.any(winston.transports.Console)],
    });
  });

  test('should default to "info" level if LOG_LEVEL is invalid', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
    (getConfig as jest.Mock).mockReturnValue({
      logLevel: 'invalid',
      logFormat: undefined,
      nodeEnv: 'production',
    });

    createLogger();
    expect(winston.createLogger).toHaveBeenCalledWith({
      level: 'info',
      format: expect.anything(),
      transports: [expect.any(winston.transports.Console)],
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith('Invalid LOG_LEVEL="invalid", falling back to info');
  });

  test('should use "debug" level in development mode by default', () => {
    (getConfig as jest.Mock).mockReturnValue({
      logLevel: undefined,
      logFormat: undefined,
      nodeEnv: 'development',
    });

    createLogger();
    expect(winston.createLogger).toHaveBeenCalledWith({
      level: 'debug',
      format: expect.anything(),
      transports: [expect.any(winston.transports.Console)],
    });
  });

  test('should use prettyPrint format if LOG_FORMAT is "prettyPrint"', () => {
    (getConfig as jest.Mock).mockReturnValue({
      logLevel: 'info',
      logFormat: 'prettyPrint',
      nodeEnv: 'production',
    });

    createLogger();
    expect(winston.format.combine).toHaveBeenCalledWith(
      winston.format.timestamp(),
      winston.format.prettyPrint(),
    );
  });

  test('should use json format by default', () => {
    (getConfig as jest.Mock).mockReturnValue({
      logLevel: 'info',
      logFormat: undefined,
      nodeEnv: 'production',
    });

    createLogger();
    expect(winston.format.combine).toHaveBeenCalledWith(
      winston.format.timestamp(),
      winston.format.json(),
    );
  });
});

