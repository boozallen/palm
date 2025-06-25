import { act, render, renderHook } from '@testing-library/react';
import { useForm, UseFormReturnType, zodResolver } from '@mantine/form';

import { AddKbProviderBedrockInputs, AddKbProviderBedrockWriteAccessInputs } from './AddKbProviderBedrockInputs';
import { conditionalKbProviderSchema, KbProviderForm, KbProviderType } from '@/features/shared/types';

/* Helper function to render the BedrockInputs form */
const bedrockInputs = (form: UseFormReturnType<KbProviderForm>) => {
  /* Ternary used to determine whether to use basic form or write access form */
  const Component = !form.values.writeAccess ?
    AddKbProviderBedrockInputs :
    AddKbProviderBedrockWriteAccessInputs;

  return <Component form={form} />;
};

describe('BedrockInputs', () => {
  let mockForm: UseFormReturnType<KbProviderForm>;

  beforeEach(() => {
    mockForm = renderHook(() => useForm<KbProviderForm>({
      initialValues: {
        label: 'Test',
        kbProviderType: KbProviderType.KbProviderBedrock,
        writeAccess: false,
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
    const { getByLabelText } = render(
      bedrockInputs(mockForm)
    );

    expect(getByLabelText('Access Key Id')).toBeInTheDocument();
    expect(getByLabelText('Secret Access Key')).toBeInTheDocument();
    expect(getByLabelText('Session Token')).toBeInTheDocument();
    expect(getByLabelText('Region')).toBeInTheDocument();
  });

  it('is still a valid form with empty config fields', async () => {
    render(
      bedrockInputs(mockForm)
    );

    expect(mockForm.isValid()).toBe(true);
  });
});

describe('BedrockWriteAccessInputs', () => {

  let mockForm: { current: UseFormReturnType<KbProviderForm> };

  beforeEach(() => {
    mockForm = renderHook(() => useForm<KbProviderForm>({
      initialValues: {
        label: 'Test',
        kbProviderType: KbProviderType.KbProviderBedrock,
        writeAccess: true,
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
    })).result;
  });

  it('renders all write access input fields correctly', () => {
    const { getByLabelText } = render(bedrockInputs(mockForm.current));

    expect(getByLabelText('Writeable Knowledge Base ID')).toBeInTheDocument();
    expect(getByLabelText('Data Source ID')).toBeInTheDocument();
    expect(getByLabelText('S3 Bucket URI')).toBeInTheDocument();
  });

  it('sets errors upon validation if write-access fields are falsy', async () => {
    const personalDocumentLibraryKnowledgeBaseIdError = 'A knowledge base ID is required';
    const dataSourceIdError = 'A data source ID is required';
    const s3BucketUriError = 'A S3 bucket URI is required';

    render(bedrockInputs(mockForm.current));

    act(() => {
      mockForm.current.validate();
    });

    expect(
      mockForm.current.errors['config.personalDocumentLibraryKnowledgeBaseId']
    ).toBe(personalDocumentLibraryKnowledgeBaseIdError);
    expect(
      mockForm.current.errors['config.dataSourceId']
    ).toBe(dataSourceIdError);
    expect(
      mockForm.current.errors['config.s3BucketUri']
    ).toBe(s3BucketUriError);
  });
});
