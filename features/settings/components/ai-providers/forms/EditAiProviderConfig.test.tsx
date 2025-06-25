import { render } from '@testing-library/react';
import { EditAiProviderConfig } from './EditAiProviderConfig';

describe('EditAiProviderConfig', () => {
  const formMock = {
    getInputProps: jest.fn((fieldName) => ({
      name: fieldName,
      value: '',
      onChange: jest.fn(),
    })),
  };

  const handleReplaceMock = jest.fn();

  const baseProps = {
    form: formMock as any,
    displayInputApiEndpoint: false,
    displayInputApiKey: false,
    displayAwsFields: false,
    replaceApiKey: false,
    replaceAwsFields: {
      accessKeyId: false,
      secretAccessKey: false,
      sessionToken: false,
    },
    handleReplace: handleReplaceMock,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when no display flags are enabled', () => {
    const { container } = render(<EditAiProviderConfig {...baseProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders API endpoint field when displayInputApiEndpoint is true', () => {
    const props = {
      ...baseProps,
      displayInputApiEndpoint: true,
    };

    const { getByTestId } = render(<EditAiProviderConfig {...props} />);
    expect(getByTestId('input-api-endpoint')).toBeInTheDocument();
  });

  it('renders API key placeholder when displayInputApiKey is true and replaceApiKey is false', () => {
    const props = {
      ...baseProps,
      displayInputApiKey: true,
      replaceApiKey: false,
    };

    const { getByTestId } = render(<EditAiProviderConfig {...props} />);
    expect(getByTestId('replace-api-key')).toBeInTheDocument();
  });

  it('renders API key input when displayInputApiKey and replaceApiKey are true', () => {
    const props = {
      ...baseProps,
      displayInputApiKey: true,
      replaceApiKey: true,
    };

    const { getByTestId } = render(<EditAiProviderConfig {...props} />);
    expect(getByTestId('input-api-key')).toBeInTheDocument();
  });

  it('renders AWS fields when displayAwsFields is true', () => {
    const props = {
      ...baseProps,
      displayAwsFields: true,
    };

    const { getByTestId, getByLabelText } = render(<EditAiProviderConfig {...props} />);
    
    expect(getByTestId('replace-access-key-id')).toBeInTheDocument();
    expect(getByTestId('replace-secret-access-key')).toBeInTheDocument();
    expect(getByTestId('replace-session-token')).toBeInTheDocument();
    expect(getByLabelText('Region')).toBeInTheDocument();
  });

  it('renders AWS fields with inputs when corresponding replace flags are true', () => {
    const props = {
      ...baseProps,
      displayAwsFields: true,
      replaceAwsFields: {
        accessKeyId: true,
        secretAccessKey: true,
        sessionToken: true,
      },
    };

    const { getByLabelText } = render(<EditAiProviderConfig {...props} />);
    
    expect(getByLabelText('Access Key ID')).toBeInTheDocument();
    expect(getByLabelText('Secret Access Key')).toBeInTheDocument();
    expect(getByLabelText('Session Token')).toBeInTheDocument();
    expect(getByLabelText('Region')).toBeInTheDocument();
  });

  it('renders correct combination of fields for OpenAI provider', () => {
    const openAiProps = {
      ...baseProps,
      displayInputApiKey: true,
      displayInputApiEndpoint: false,
      displayAwsFields: false,
    };

    const { getByTestId, queryByTestId } = render(<EditAiProviderConfig {...openAiProps} />);
    
    expect(getByTestId('replace-api-key')).toBeInTheDocument();
    expect(queryByTestId('input-api-endpoint')).not.toBeInTheDocument();
    expect(queryByTestId('replace-access-key-id')).not.toBeInTheDocument();
  });

  it('renders correct combination of fields for Azure OpenAI provider', () => {
    const azureProps = {
      ...baseProps,
      displayInputApiKey: true,
      displayInputApiEndpoint: true,
      displayAwsFields: false,
    };

    const { getByTestId, queryByTestId } = render(<EditAiProviderConfig {...azureProps} />);
    
    expect(getByTestId('replace-api-key')).toBeInTheDocument();
    expect(getByTestId('input-api-endpoint')).toBeInTheDocument();
    expect(queryByTestId('replace-access-key-id')).not.toBeInTheDocument();
  });

  it('renders correct combination of fields for Bedrock provider', () => {
    const bedrockProps = {
      ...baseProps,
      displayInputApiKey: false,
      displayInputApiEndpoint: false,
      displayAwsFields: true,
    };

    const { getByTestId, queryByTestId } = render(<EditAiProviderConfig {...bedrockProps} />);
    
    expect(queryByTestId('replace-api-key')).not.toBeInTheDocument();
    expect(queryByTestId('input-api-endpoint')).not.toBeInTheDocument();
    expect(getByTestId('replace-access-key-id')).toBeInTheDocument();
    expect(getByTestId('replace-secret-access-key')).toBeInTheDocument();
    expect(getByTestId('replace-session-token')).toBeInTheDocument();
  });
});
