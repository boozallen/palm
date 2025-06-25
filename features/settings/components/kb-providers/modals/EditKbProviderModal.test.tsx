import { render } from '@testing-library/react';
import EditKbProviderModal from './EditKbProviderModal';
import useGetKbProvider from '@/features/settings/api/get-kb-provider';

jest.mock('@/features/settings/api/get-kb-provider');

jest.mock('@/features/settings/components/kb-providers/forms/EditKbProviderForm', () => {
  return function MockEditKbProviderForm() {
    return <div>Edit KB Provider Form</div>;
  };
});

(useGetKbProvider as jest.Mock).mockReturnValue({
  data: {
    kbProvider: {
      id: 'c2f5e94e-9048-450f-adf8-6e2de630a799',
      kbProviderType: 1,
      writeAccess: false,
      label: 'My KB Provider',
      config: {
        apiEndpoint: 'https://api.example.com',
        apiKey: '12345',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
});

describe('EditKbProviderModal', () => {
  const closeMock = jest.fn();
  const kbProviderId = '681ec1ae-3e76-4012-a997-10422c4ccb68';

  it('should render edit KB provider modal when opened prop is true', () => {
    const { queryByText } = render(
      <EditKbProviderModal
        kbProviderId={kbProviderId}
        modalOpen={true}
        closeModalHandler={closeMock}
      />
    );
    expect(queryByText('Edit Knowledge Base Provider')).toBeInTheDocument();
  });

  it('should not render edit KB provider modal when opened prop is false', () => {
    const { queryByText } = render(
      <EditKbProviderModal
        kbProviderId={kbProviderId}
        modalOpen={false}
        closeModalHandler={closeMock}
      />
    );
    expect(queryByText('Edit Knowledge Base Provider')).not.toBeInTheDocument();
  });
});
