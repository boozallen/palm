import { render } from '@testing-library/react';
import { useForm } from '@mantine/form';
import { KbProviderForm } from '@/features/shared/types';
import { EditKbProviderBedrockInputs, EditKbProviderBedrockWriteAccessInputs } from './EditKbProviderBedrockInputs';

describe('BedrockInputs', () => {

  const BedrockInputsWrapper = () => {
    const mockForm = useForm<KbProviderForm>({
      initialValues: {
        label: '',
        kbProviderType: 0,
        writeAccess: false,
        config: {
          accessKeyId: '',
          secretAccessKey: '',
          sessionToken: '',
          region: '',
        },
      },
      validate: jest.fn(),
    });

    return <EditKbProviderBedrockInputs form={mockForm} />;
  };

  it('renders all input fields correctly', () => {
    const { getByLabelText } = render(<BedrockInputsWrapper />);

    expect(getByLabelText('Access Key Id')).toBeInTheDocument();
    expect(getByLabelText('Secret Access Key')).toBeInTheDocument();
    expect(getByLabelText('Session Token')).toBeInTheDocument();
    expect(getByLabelText('Region')).toBeInTheDocument();
  });
});

describe('BedrockWriteAccessInputs', () => {

  const BedrockWriteAccessInputsWrapper = () => {
    const mockForm = useForm<KbProviderForm>({
      initialValues: {
        label: '',
        kbProviderType: 0,
        writeAccess: false,
        config: {
          accessKeyId: '',
          secretAccessKey: '',
          sessionToken: '',
          region: '',
        },
      },
      validate: jest.fn(),
    });

    return <EditKbProviderBedrockWriteAccessInputs form={mockForm} />;
  };

  it('renders all write access input fields correctly', () => {
    const { getByLabelText } = render(<BedrockWriteAccessInputsWrapper />);

    expect(getByLabelText('Writeable Knowledge Base ID')).toBeInTheDocument();
    expect(getByLabelText('Data Source ID')).toBeInTheDocument();
    expect(getByLabelText('S3 Bucket URI')).toBeInTheDocument();
  });
});
