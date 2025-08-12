import getSystemConfig from './getSystemConfig'; 
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  systemConfig: {
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
}));

const defaultMessage = 'Persona: You are a helpful assistant';

describe('getSystemConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks(); 
  });

  it('successfully retrieves system config when it exists', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue({
      systemMessage: defaultMessage,
    });

    const config = await getSystemConfig();

    expect(config).toEqual({ systemMessage: defaultMessage });
    expect(db.systemConfig.findFirst).toHaveBeenCalledTimes(1);
  });

  it('creates and retrieves default system config when none exists', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue(null);
    (db.systemConfig.count as jest.Mock).mockResolvedValue(0);
    (db.systemConfig.create as jest.Mock).mockResolvedValue({
      systemMessage: defaultMessage,
    });

    const config = await getSystemConfig();

    expect(config).toEqual({ systemMessage: defaultMessage });
    expect(db.systemConfig.findFirst).toHaveBeenCalledTimes(1);
    expect(db.systemConfig.count).toHaveBeenCalledTimes(1);
    expect(db.systemConfig.create).toHaveBeenCalledTimes(1);
  });
});
