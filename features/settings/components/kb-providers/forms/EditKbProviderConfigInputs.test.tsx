import { render } from '@testing-library/react';
import { useForm } from '@mantine/form';

import { KbProviderForm, KbProviderType } from '@/features/shared/types';
import { EditKbProviderConfigInputs } from './EditKbProviderConfigInputs';

describe('ProviderConfigInputs', () => {
  const ProviderConfigInputsWrapper = ({
    selectedKbProvider,
    errors = {},
  }: {
    selectedKbProvider: KbProviderType;
    errors?: Record<string, string>;
  }) => {
    const mockForm = useForm<KbProviderForm>({
      initialValues: {
        label: '',
        kbProviderType: 0,
        config: {
          apiKey: '',
          apiEndpoint: '',
          accessKeyId: '',
          secretAccessKey: '',
          sessionToken: '',
          region: '',
        },
      },
      validate: jest.fn(),
    });

    mockForm.errors = errors;

    return <EditKbProviderConfigInputs form={mockForm} selectedKbProvider={selectedKbProvider} />;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders API Endpoint and API Key inputs for KbProviderPalm', () => {
    const { getByLabelText } = render(
      <ProviderConfigInputsWrapper selectedKbProvider={KbProviderType.KbProviderPalm} />
    );

    expect(getByLabelText('API Endpoint')).toBeInTheDocument();
    expect(getByLabelText('API Key')).toBeInTheDocument();
  });

  it('renders Bedrock inputs for KbProviderBedrock', () => {
    const { getByLabelText } = render(
      <ProviderConfigInputsWrapper selectedKbProvider={KbProviderType.KbProviderBedrock} />
    );

    expect(getByLabelText('Access Key Id')).toBeInTheDocument();
    expect(getByLabelText('Secret Access Key')).toBeInTheDocument();
    expect(getByLabelText('Session Token')).toBeInTheDocument();
    expect(getByLabelText('Region')).toBeInTheDocument();
  });
});
