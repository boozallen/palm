import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from '@mantine/form';

import Form from './Form';
import useGetAvailableModels from '@/features/shared/api/get-available-models';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@mantine/form');
jest.mock('@/features/shared/api/get-available-models');

describe('Research Form', () => {
  const mockOnSubmit = jest.fn();
  const handleDownload = jest.fn();

  const availableModels = [
    {
      id: '92be6efd-7334-408f-b943-baf286a7fe27',
      name: 'GPT-4',
      providerLabel: 'OpenAI',
    },
    {
      id: '78be3efd-1234-408f-b943-baf286a7fe21',
      name: 'Claude 3',
      providerLabel: 'Anthropic',
    },
  ];

  const mockFormValues = {
    model: '92be6efd-7334-408f-b943-baf286a7fe27',
    dateRange: 'last-30-days',
    categories: ['AI', 'Computer Vision', 'NLP'],
    institutions: 'Harvard, Stanford',
  };

  const mockUseForm = (overrides = {}) => {
    const defaultMock = {
      values: mockFormValues,
      getInputProps: jest.fn(),
      onSubmit: jest.fn((cb) => () => cb(mockFormValues)),
      isValid: () => true,
      setFieldValue: jest.fn(),
    };

    return jest.fn().mockReturnValue({ ...defaultMock, ...overrides });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetAvailableModels as jest.Mock).mockReturnValue({
      data: { availableModels },
    });

    (useForm as jest.Mock).mockImplementation(mockUseForm());
  });

  it('renders correct form fields', () => {
    render(
      <Form
        isLoading={false}
        onSubmit={mockOnSubmit}
        handleDownload={handleDownload}
      />
    );

    const model = screen.getByLabelText('Model');
    const dateRange = screen.getByLabelText('Time Period');
    const category = screen.getByLabelText('Research Category');
    const institutions = screen.getByLabelText('Institutions');

    expect(model).toBeInTheDocument();
    expect(dateRange).toBeInTheDocument();
    expect(category).toBeInTheDocument();
    expect(institutions).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    render(
      <Form
        isLoading={false}
        onSubmit={mockOnSubmit}
        handleDownload={handleDownload}
      />
    );

    const submitButton = screen.getByRole('button', {
      name: /search & analyze/i,
    });
    expect(submitButton).toBeInTheDocument();
  });

  it('submits form with correct values when form is valid', async () => {
    render(
      <Form
        isLoading={false}
        onSubmit={mockOnSubmit}
        handleDownload={handleDownload}
      />
    );

    const form = screen.getByTestId('research-form');
    fireEvent.submit(form);

    expect(mockOnSubmit).toHaveBeenCalledWith({
      model: '92be6efd-7334-408f-b943-baf286a7fe27',
      dateRange: 'last-30-days',
      categories: ['AI', 'Computer Vision', 'NLP'],
      institutions: 'Harvard, Stanford',
    });
  });

  it('saves form values to localStorage on form submit', () => {
    const setItemSpy = jest.spyOn(window.localStorage.__proto__, 'setItem');

    render(
      <Form
        isLoading={false}
        onSubmit={mockOnSubmit}
        handleDownload={handleDownload}
      />
    );

    const form = screen.getByTestId('research-form');
    fireEvent.submit(form);

    expect(setItemSpy).toHaveBeenCalledWith(
      'researchForm',
      JSON.stringify(mockFormValues)
    );

    setItemSpy.mockRestore();
  });
});
