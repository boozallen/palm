import { render } from '@testing-library/react';
import SystemConfigurations from './SystemConfigurations';

jest.mock('./tables/SystemPersonaTable', () => {
  return function SystemPersonaTable() {
    return <div data-testid='system-persona-table' />;
  };
});

jest.mock('./tables/TermsOfUseTable', () => {
  return function TermsOfUseTable() {
    return <div data-testid='terms-of-use-table' />;
  };
});

jest.mock('./tables/LegalPolicyTable', () => {
  return function LegalPolicyTable() {
    return <div data-testid='legal-policy-table' />;
  };
});

jest.mock('./tables/DefaultUserGroupSelectionTable', () => {
  return function DefaultUserGroupSelectionTable() {
    return <div data-testid='default-user-group-selection' />;
  };
});

jest.mock('./tables/SystemAiProviderModelSelectionTable', () => {
  return function DefaultUserGroupSelectionTable() {
    return <div data-testid='system-ai-provider-model-selection-table' />;
  };
});

jest.mock('./tables/DocumentLibraryKbProviderSelectionTable', () => {
  return function DocumentLibraryKbProviderSelectionTable() {
    return <div data-testid='document-library-kb-provider-selection-table' />;
  };
});

jest.mock('./tables/FeatureManagementTable', () => {
  return function FeatureManagementTable() {
    return <div data-testid='feature-management-table' />;
  };
});

describe('SystemConfigurations', () => {
  beforeEach(() => {
    jest.clearAllMocks();

  });

  it('should render "System Configurations" title', () => {
    const { queryByText } = render(<SystemConfigurations />);
    expect(queryByText('System Configurations')).toBeInTheDocument();
  });

  it('renders tables', () => {
    const { queryByTestId } = render(<SystemConfigurations />);
    expect(queryByTestId('system-persona-table')).toBeInTheDocument();
    expect(queryByTestId('terms-of-use-table')).toBeInTheDocument();
    expect(queryByTestId('legal-policy-table')).toBeInTheDocument();
    expect(queryByTestId('default-user-group-selection')).toBeInTheDocument();
    expect(queryByTestId('system-ai-provider-model-selection-table')).toBeInTheDocument();
    expect(queryByTestId('document-library-kb-provider-selection-table')).toBeInTheDocument();
    expect(queryByTestId('feature-management-table')).toBeInTheDocument();
  });

});
