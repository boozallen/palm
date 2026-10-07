import { render, screen } from '@testing-library/react';

import ModelSelect from './ModelSelect';
import { useGetAiProviderModelSelectData } from '@/features/shared/data';

jest.mock('@/features/shared/data');

/* MOCK GET MODEL SELECT DATA */
let models: {label: string, value: string, group: string}[] = [];

function mockGetModelSelectData(isError: boolean = false, error?: Error) {
  (useGetAiProviderModelSelectData as jest.Mock).mockReturnValue({
    modelOptions: models,
    modelsIsError: isError,
    modelsError: error,
  });
}

/* MOCK GET MODEL SELECT DATA HELPER FUNCTIONS */
function addMockModel(label: string, group: string) {
  models.push({
    value: `${group}: ${label}`,
    label,
    group,
  });
}

function removeMockModel() {
  return models.pop() ?? { label: '', value: '', group: '' };
}

function clearModels() {
  models = [];
}

describe('ModelSelect', () => {
  const setValue = jest.fn();
  const onChange = jest.fn();

  beforeEach(() => {
    addMockModel('GPT-4o', 'OpenAI');
    addMockModel('Sonnet 3.5', 'Anthropic');
    mockGetModelSelectData();
  });

  afterEach(() => {
    clearModels();
    jest.resetAllMocks();
    jest.clearAllMocks();
  });

  it('renders select input if there is no error', () => {
    render(
      <ModelSelect
        value={models[0].value}
        setValue={setValue}
        onChange={onChange}
      />
    );

    const input = screen.getByLabelText('Language model');
    expect(input).toBeInTheDocument();
  });

  it('renders error in place of select component if error getting models', () => {
    mockGetModelSelectData(true, new Error('Error getting models'));

    render(
      <ModelSelect
        value={models[0].value}
        setValue={setValue}
        onChange={onChange}
      />
    );

    const error = screen.getByText('Error getting models');
    const input = screen.queryByLabelText('Language model');

    expect(error).toBeInTheDocument();
    expect(input).not.toBeInTheDocument();
  });

  it('sets input to value passed via props', () => {
    render(
      <ModelSelect
        value={models[0].value}
        setValue={setValue}
        onChange={onChange}
      />
    );

    const input = screen.getByLabelText('Language model');
    expect(input).toHaveValue(models[0].label);
  });

  it('changes input value if model is not available', () => {
    const removedModel = removeMockModel();

    render(
      <ModelSelect
        value={removedModel.value}
        setValue={setValue}
        onChange={onChange}
      />
    );

    expect(setValue).toHaveBeenCalledWith(models[0].value);
  });
});
