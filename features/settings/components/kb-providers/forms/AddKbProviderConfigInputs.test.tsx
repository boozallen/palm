import { render, waitFor } from '@testing-library/react';
import { useForm } from '@mantine/form';
import { KbProviderForm, KbProviderType } from '@/features/shared/types';
import { useGetFeatureFlag } from '@/features/shared/api/get-feature-flag';
import { AddKbProviderConfigInputs } from './AddKbProviderConfigInputs';
import userEvent from '@testing-library/user-event';

jest.mock('@/features/shared/api/get-feature-flag', () => ({
  useGetFeatureFlag: jest.fn(),
}));

describe('ProviderConfigInputs', () => {
  const ProviderConfigInputsWrapper = ({
    selectedKbProvider,
    writeAccess = false,
    errors = {},
  }: {
    selectedKbProvider: KbProviderType;
    writeAccess?: boolean;
    errors?: Record<string, string>;
  }) => {
    const mockForm = useForm<KbProviderForm>({
      initialValues: {
        label: '',
        kbProviderType: 0,
        writeAccess,
        config: {
          apiKey: '',
          apiEndpoint: '',
          accessKeyId: '',
          secretAccessKey: '',
          sessionToken: '',
          region: '',
          personalDocumentLibraryKnowledgeBaseId: '',
          dataSourceId: '',
          s3BucketUri: '',
        },
      },
      validate: jest.fn(),
    });

    mockForm.errors = errors;

    return <AddKbProviderConfigInputs form={mockForm} selectedKbProvider={selectedKbProvider} />;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders API Endpoint and API Key inputs for KbProviderPalm', () => {
    (useGetFeatureFlag as jest.Mock).mockReturnValue({ data: { isFeatureOn: true } });

    const { getByLabelText } = render(
      <ProviderConfigInputsWrapper selectedKbProvider={KbProviderType.KbProviderPalm} />
    );

    expect(getByLabelText('API Endpoint')).toBeInTheDocument();
    expect(getByLabelText('API Key')).toBeInTheDocument();
  });

  it('renders Bedrock inputs for KbProviderBedrock', () => {
    (useGetFeatureFlag as jest.Mock).mockReturnValue({ data: { isFeatureOn: true } });

    const { getByLabelText } = render(
      <ProviderConfigInputsWrapper selectedKbProvider={KbProviderType.KbProviderBedrock} />
    );

    expect(getByLabelText('Access Key Id')).toBeInTheDocument();
    expect(getByLabelText('Secret Access Key')).toBeInTheDocument();
    expect(getByLabelText('Session Token')).toBeInTheDocument();
    expect(getByLabelText('Region')).toBeInTheDocument();
  });

  it('renders write access checkbox when feature flag is on', () => {
    (useGetFeatureFlag as jest.Mock).mockReturnValue({ data: { isFeatureOn: true } });

    const { getByRole } = render(
      <ProviderConfigInputsWrapper selectedKbProvider={KbProviderType.KbProviderPalm} />
    );

    expect(getByRole('checkbox', { name: 'Write Access' })).toBeInTheDocument();
  });

  it('does not render write access checkbox when feature flag is off', () => {
    (useGetFeatureFlag as jest.Mock).mockReturnValue({ data: { isFeatureOn: false } });

    const { queryByRole } = render(
      <ProviderConfigInputsWrapper selectedKbProvider={KbProviderType.KbProviderPalm} />
    );

    expect(queryByRole('checkbox', { name: 'Write Access' })).not.toBeInTheDocument();
  });

  it('shows tooltip on hover over write access checkbox', async () => {
    (useGetFeatureFlag as jest.Mock).mockReturnValue({ data: { isFeatureOn: true } });

    const { getByRole, getByText } = render(
      <ProviderConfigInputsWrapper selectedKbProvider={KbProviderType.KbProviderPalm} />
    );

    const writeAccessCheckbox = await waitFor(() => getByRole('checkbox', { name: 'Write Access' }));
    await userEvent.hover(writeAccessCheckbox);

    expect(getByText('Provider supports personal document library functionality')).toBeInTheDocument();
  });

  it('renders BedrockWriteAccessInputs when write access is checked for Bedrock provider', () => {
    (useGetFeatureFlag as jest.Mock).mockReturnValue({ data: { isFeatureOn: true } });

    const { getByLabelText } = render(
      <ProviderConfigInputsWrapper
        selectedKbProvider={KbProviderType.KbProviderBedrock}
        writeAccess={true}
      />
    );

    expect(getByLabelText('Writeable Knowledge Base ID')).toBeInTheDocument();
    expect(getByLabelText('Data Source ID')).toBeInTheDocument();
    expect(getByLabelText('S3 Bucket URI')).toBeInTheDocument();
  });

  it('does not render BedrockWriteAccessInputs when Bedrock is not the selected provider', () => {
    (useGetFeatureFlag as jest.Mock).mockReturnValue({ data: { isFeatureOn: true } });

    const { queryByLabelText } = render(
      <ProviderConfigInputsWrapper
        selectedKbProvider={KbProviderType.KbProviderPalm}
        writeAccess={true}
      />
    );

    expect(queryByLabelText('Writeable Knowledge Base ID')).not.toBeInTheDocument();
    expect(queryByLabelText('Data Source ID')).not.toBeInTheDocument();
    expect(queryByLabelText('S3 Bucket URI')).not.toBeInTheDocument();
  });
});
