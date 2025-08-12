export default jest.fn().mockImplementation(() => ({
  mutateAsync: jest.fn(),
  isPending: false,
  error: null,
}));
