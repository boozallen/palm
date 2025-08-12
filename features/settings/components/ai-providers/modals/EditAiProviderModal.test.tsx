import { render } from '@testing-library/react';
import EditAiProviderModal from './EditAiProviderModal';
import useGetAiProvider from '@/features/settings/api/get-ai-provider';
import { AiProviderType } from '@/features/shared/types';

jest.mock('@/features/settings/api/get-ai-provider');

jest.mock('@/features/settings/components/ai-providers/forms/EditAiProviderForm', () => {
  return function MockEditAiProviderForm() {
    return <div>Edit AI Provider Form</div>;
  };
});

(useGetAiProvider as jest.Mock).mockReturnValue({
  data: {
    provider: {
      id: 'c2f5e94e-9048-450f-adf8-6e2de630a799',
      typeId: AiProviderType.OpenAi,
      label: 'OpenAI Provider',
      config: {
        id: '8a00cd11-daf7-4291-88ba-87431ff573da',
        apiEndpoint: null,
        region: null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
});

describe('EditAiProviderModal', () => {
  const closeMock = jest.fn();
  const aiProviderId = '681ec1ae-3e76-4012-a997-10422c4ccb68';
  it('should render edit ai provider modal when opened prop is true', () => {
    const { queryByText } = render(
      <EditAiProviderModal
        aiProviderId={aiProviderId}
        modalOpen={true}
        closeModalHandler={closeMock}
      />
    );
    expect(queryByText('Edit AI Provider')).toBeInTheDocument();
  });

  it('should not render edit ai provider modal when opened prop is false', () => {
    const { queryByText } = render(
      <EditAiProviderModal
        aiProviderId={aiProviderId}
        modalOpen={false}
        closeModalHandler={closeMock}
      />
    );
    expect(queryByText('Edit AI Provider')).not.toBeInTheDocument();
  });
});
