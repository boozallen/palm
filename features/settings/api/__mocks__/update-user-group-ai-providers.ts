export default jest.fn().mockImplementation(() => ({
  mutateAsync: jest.fn(),
  isPending: false,
  isError: false,
  error: null,
}));
