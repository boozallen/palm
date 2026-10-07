import ownedArtifactWhere from '@/features/chat/dal/ownedArtifactWhere';

describe('ownedArtifactWhere', () => {
  it('reaches an artifact only through a chat the user owns', () => {
    expect(ownedArtifactWhere('user-1')).toEqual({
      message: {
        chat: {
          userId: 'user-1',
        },
      },
    });
  });
});
