const mockData = [
  {
    id: 'e84362ac-8205-4caa-8ef1-485a03546a0a',
    label: 'Test Knowledge Base',
    apiEndpoint: 'https://api.example.com',
  },
  {
    id: '2de13f65-c6aa-4df4-a7a1-eb20ceeff87b',
    label: 'Test Knowledge Base 2',
    apiEndpoint: 'https://api.example.com',
  },
];

export default jest.fn().mockImplementation(() => ({
  data: mockData,
  isPending: false,
  error: null,
}));
