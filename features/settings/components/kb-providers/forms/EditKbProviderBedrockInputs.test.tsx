import { render } from '@testing-library/react';
import { useForm } from '@mantine/form';
import { KbProviderForm } from '@/features/shared/types';
import { EditKbProviderBedrockInputs } from './EditKbProviderBedrockInputs';

describe('BedrockInputs', () => {

  const BedrockInputsWrapper = () => {
    const mockForm = useForm<KbProviderForm>({
      initialValues: {
        label: '',
        kbProviderType: 0,
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
