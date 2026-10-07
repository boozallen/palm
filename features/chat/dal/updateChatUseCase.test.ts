import updateChatUseCase from './updateChatUseCase';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  chat: {
    updateMany: jest.fn(),
  },
}));

describe('updateChatUseCase DAL', () => {
  const mockInput = {
    id: 'aa356d1f-dd68-4f6b-82a9-ec9220973857',
    useCase: 'Engineering',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.chat.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  });

  it('writes the use case', async () => {
    await updateChatUseCase(mockInput);

    expect(db.chat.updateMany).toHaveBeenCalledWith({
      where: { id: mockInput.id, useCase: null },
      data: { useCase: mockInput.useCase },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  // First writer wins, enforced by the database rather than by the caller. Two turns
  // of one chat finishing together can both read a null category and both classify;
  // this filter is what stops the loser overwriting the winner.
  it('only writes to a chat that has no use case yet', async () => {
    await updateChatUseCase(mockInput);

    const { where } = (db.chat.updateMany as jest.Mock).mock.calls[0][0];
    expect(where).toEqual({ id: mockInput.id, useCase: null });
  });

  // A filtered write matching nothing means somebody else got there first, which is
  // an expected outcome and not an error to raise.
  it('resolves without error when the chat is already categorized', async () => {
    (db.chat.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await expect(updateChatUseCase(mockInput)).resolves.toBeUndefined();

    expect(logger.error).not.toHaveBeenCalled();
  });

  // This writer runs after the title is set, so touching summary here would overwrite
  // a title the user is already looking at in the sidebar.
  it('writes nothing but the use case', async () => {
    await updateChatUseCase(mockInput);

    const { data } = (db.chat.updateMany as jest.Mock).mock.calls[0][0];
    expect(Object.keys(data)).toEqual(['useCase']);
  });

  it('throws a sanitized error if the update fails', async () => {
    const rejectError = new Error('Failed to update');
    (db.chat.updateMany as jest.Mock).mockRejectedValueOnce(rejectError);

    await expect(updateChatUseCase(mockInput)).rejects.toThrow('Error updating chat use case');

    expect(logger.error).toHaveBeenCalledWith(
      `Error updating chat use case: ChatId: ${mockInput.id}`,
      rejectError,
    );
  });
});
