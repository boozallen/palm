import { render, renderHook } from '@testing-library/react';
import { useForm, UseFormReturnType, zodResolver } from '@mantine/form';

import { AddKbProviderBedrockInputs } from './AddKbProviderBedrockInputs';
import { conditionalKbProviderSchema, KbProviderForm, KbProviderType } from '@/features/shared/types';

/* Helper function to render the BedrockInputs form */
const bedrockInputs = (form: UseFormReturnType<KbProviderForm>) => {
  return <AddKbProviderBedrockInputs form={form} />;
};

describe('BedrockInputs', () => {
  let mockForm: UseFormReturnType<KbProviderForm>;

  beforeEach(() => {
    mockForm = renderHook(() => useForm<KbProviderForm>({
      initialValues: {
        label: 'Test',
        kbProviderType: KbProviderType.KbProviderBedrock,
        config: {
          accessKeyId: '',
          secretAccessKey: '',
          sessionToken: '',
          region: '',
        },
      },
      validate: zodResolver(
        conditionalKbProviderSchema(KbProviderType.KbProviderBedrock)
      ),
    })).result.current;
  });

  it('renders all input fields correctly', () => {
    const { getByLabelText, getByText } = render(
      bedrockInputs(mockForm)
    );

    expect(getByLabelText('Access Key Id')).toBeInTheDocument();
    expect(getByText('Leave blank to inherit AWS_ACCESS_KEY_ID environment variable')).toBeInTheDocument();
    expect(getByLabelText('Secret Access Key')).toBeInTheDocument();
    expect(getByText('Leave blank to inherit AWS_SECRET_ACCESS_KEY environment variable')).toBeInTheDocument();
    expect(getByLabelText('Session Token')).toBeInTheDocument();
    expect(getByText('Leave blank to inherit AWS_SESSION_TOKEN environment variable')).toBeInTheDocument();
    expect(getByLabelText('Region')).toBeInTheDocument();
    expect(getByText('Leave blank to inherit AWS_REGION environment variable')).toBeInTheDocument();
  });

  it('is still a valid form with empty config fields', async () => {
    render(
      bedrockInputs(mockForm)
    );

    expect(mockForm.isValid()).toBe(true);
  });
});
