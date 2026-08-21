const mRedis = jest.fn(() => ({
  on: jest.fn(),
  quit: jest.fn(),
  disconnect: jest.fn(),
  hset: jest.fn(),
  hgetall: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

export default mRedis;
