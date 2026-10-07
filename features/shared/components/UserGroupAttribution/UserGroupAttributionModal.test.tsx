import { fireEvent, render, screen } from '@testing-library/react';

import UserGroupAttributionModal from './UserGroupAttributionModal';
import { UserGroupAttributionProvider } from '@/features/shared/providers/UserGroupAttribution/UserGroupAttributionProvider';
import { useUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution';
import { useCreateClientSideAuditRecord } from '@/features/shared/api/create-client-side-audit-record';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';
import useGetUserGroups from '@/features/profile/api/get-user-groups';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import useGetEmbeddingEligibleAiProviders from '@/features/shared/api/document-upload/get-embedding-eligible-ai-providers';

jest.mock('@/features/profile/api/get-user-groups');
jest.mock('@/features/shared/api/get-available-models');
jest.mock('@/features/shared/api/document-upload/get-embedding-eligible-ai-providers');

const mockUseGetUserGroups = useGetUserGroups as jest.Mock;
const mockUseGetAvailableModels = useGetAvailableModels as jest.Mock;
const mockUseGetEmbeddingEligibleAiProviders = useGetEmbeddingEligibleAiProviders as jest.Mock;
const mockCreateAuditRecord = jest.fn();
(useCreateClientSideAuditRecord as jest.Mock).mockReturnValue({ mutate: mockCreateAuditRecord });

const twoGroups = [
  { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1'] },
  { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: ['provider-1'] },
];

// A page that can trigger a forced gate() decision against a specific model —
// mirrors what ChatForm/Agent forms etc. do in real usage on submit.
function GateTrigger({ modelId }: Readonly<{ modelId: string | undefined }>) {
  const { gate } = useUserGroupAttribution();
  return (
    <button
      data-testid='trigger-gate'
      onClick={() => {
        gate(modelId, jest.fn());
      }}
    >
      submit
    </button>
  );
}

const renderModal = (isCollapsed: boolean, modelId: string | undefined = undefined) => render(
  <UserGroupAttributionProvider>
    <GateTrigger modelId={modelId} />
    <UserGroupAttributionModal isCollapsed={isCollapsed} />
  </UserGroupAttributionProvider>,
);

const renderModalWithNoGateTrigger = (isCollapsed: boolean) => render(
  <UserGroupAttributionProvider>
    <UserGroupAttributionModal isCollapsed={isCollapsed} />
  </UserGroupAttributionProvider>,
);

const openSelect = () => {
  fireEvent.click(screen.getByTestId('user-group-attribution-modal-trigger'));
  fireEvent.mouseDown(screen.getByTestId('user-group-attribution-modal-select'));
};

const chooseAndSubmit = (optionTestId: string) => {
  fireEvent.mouseDown(screen.getByTestId(optionTestId));
  fireEvent.click(screen.getByTestId('user-group-attribution-modal-submit'));
};

describe('UserGroupAttributionModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockUseGetUserGroups.mockReturnValue({ data: { userGroups: twoGroups } });
    mockUseGetAvailableModels.mockReturnValue({
      data: { availableModels: [{ id: 'model-1', aiProviderId: 'provider-1' }] },
    });
    mockUseGetEmbeddingEligibleAiProviders.mockReturnValue({ data: { aiProviderIds: [] } });
  });

  it('does not render at all when the account has 0 user groups', () => {
    mockUseGetUserGroups.mockReturnValue({ data: { userGroups: [] } });
    renderModal(false);

    expect(screen.queryByTestId('user-group-attribution-modal-trigger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-group-attribution-single-group-indicator')).not.toBeInTheDocument();
  });

  it('shows a read-only single-group indicator, not the interactive trigger, when the account has exactly 1 user group', () => {
    mockUseGetUserGroups.mockReturnValue({ data: { userGroups: [twoGroups[0]] } });
    renderModalWithNoGateTrigger(false);

    expect(screen.queryByTestId('user-group-attribution-modal-trigger')).not.toBeInTheDocument();
    expect(screen.getByTestId('user-group-attribution-single-group-label')).toHaveTextContent('User Group One');
  });

  it('labels the collapsed single-group indicator with a tooltip naming the group', () => {
    mockUseGetUserGroups.mockReturnValue({ data: { userGroups: [twoGroups[0]] } });
    renderModalWithNoGateTrigger(true);

    expect(screen.getByTestId('user-group-attribution-single-group-indicator')).toHaveAttribute(
      'aria-label',
      'Member of the User Group One user group',
    );
  });

  it('stays visible on a page with no gate trigger mounted, as long as the account has 2+ AI-provider-eligible groups', () => {
    renderModalWithNoGateTrigger(false);

    expect(screen.getByTestId('user-group-attribution-modal-trigger')).toBeInTheDocument();
  });

  it('shows the multi-group read-only indicator, not the interactive trigger, when fewer than 2 of the user\'s groups grant any AI provider access', () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1'] },
          { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: [] },
        ],
      },
    });
    renderModalWithNoGateTrigger(false);

    expect(screen.queryByTestId('user-group-attribution-modal-trigger')).not.toBeInTheDocument();
    expect(screen.getByTestId('user-group-attribution-multi-group-label')).toHaveTextContent('Member of 2 user groups');
  });

  it('labels the collapsed multi-group indicator with a tooltip listing every group name', () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1'] },
          { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: ['provider-2'] },
        ],
      },
    });
    renderModalWithNoGateTrigger(true);

    expect(screen.getByTestId('user-group-attribution-multi-group-indicator')).toHaveAttribute(
      'aria-label',
      'Member of 2 user groups: User Group One, User Group Two',
    );
  });

  it('renders the expanded pill with the group name once a default is saved', () => {
    renderModal(false);

    openSelect();
    chooseAndSubmit('user-group-attribution-modal-option-group-1');

    expect(screen.getByTestId('user-group-attribution-modal-value')).toHaveTextContent('User Group One');
  });

  it('shows the amber "needs attention" pill when no default is set yet', () => {
    renderModal(false);

    expect(screen.getByTestId('user-group-attribution-modal-value')).toHaveTextContent('Set default user group');
  });

  it('renders icon-only, with no visible label, when the rail is collapsed', () => {
    renderModal(true);

    expect(screen.getByTestId('user-group-attribution-modal-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('user-group-attribution-modal-value')).not.toBeInTheDocument();
  });

  it('does not persist a selection until Submit is clicked', () => {
    renderModal(false);

    openSelect();
    fireEvent.mouseDown(screen.getByTestId('user-group-attribution-modal-option-group-1'));

    expect(screen.getByTestId('user-group-attribution-modal-value')).toHaveTextContent('Set default user group');
  });

  it('discards the draft selection when Cancel is clicked', () => {
    renderModal(false);

    openSelect();
    fireEvent.mouseDown(screen.getByTestId('user-group-attribution-modal-option-group-1'));
    fireEvent.click(screen.getByTestId('user-group-attribution-modal-cancel'));

    expect(screen.getByTestId('user-group-attribution-modal-value')).toHaveTextContent('Set default user group');
  });

  it('disables Submit until a group has been chosen', () => {
    renderModal(false);

    openSelect();

    expect(screen.getByTestId('user-group-attribution-modal-submit')).toBeDisabled();
  });

  it('lists every account-wide overlapping group in the idle select, unaffected by which model a page has mounted for gate()', () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1'] },
          { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: ['provider-1'] },
          { id: 'group-3', label: 'User Group Three', role: 'User', aiProviderIds: ['provider-1'] },
        ],
      },
    });
    renderModal(false, 'model-1');

    openSelect();

    expect(screen.getByTestId('user-group-attribution-modal-option-group-1')).toBeInTheDocument();
    expect(screen.getByTestId('user-group-attribution-modal-option-group-2')).toBeInTheDocument();
    expect(screen.getByTestId('user-group-attribution-modal-option-group-3')).toBeInTheDocument();
  });

  it('excludes a group with AI access that doesn\'t overlap with any other of the user\'s groups', () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1'] },
          { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: ['provider-1'] },
          { id: 'group-3', label: 'User Group Three', role: 'User', aiProviderIds: ['provider-99'] },
        ],
      },
    });
    renderModal(false);

    openSelect();

    expect(screen.getByTestId('user-group-attribution-modal-option-group-1')).toBeInTheDocument();
    expect(screen.getByTestId('user-group-attribution-modal-option-group-2')).toBeInTheDocument();
    expect(screen.queryByTestId('user-group-attribution-modal-option-group-3')).not.toBeInTheDocument();
  });

  it('keeps showing the stored default\'s label even when it has no access to the model the current page registered for gate()', () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1', 'provider-2'] },
          { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: ['provider-2'] },
        ],
      },
    });
    renderModal(false, 'model-1'); // model-1 -> provider-1, only group-1 has it

    openSelect();
    chooseAndSubmit('user-group-attribution-modal-option-group-2');

    expect(screen.getByTestId('user-group-attribution-modal-value')).toHaveTextContent('User Group Two');
  });

  it('lists each overlapping AI provider by name, scaling to multiple groups and providers', () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1', 'provider-2'] },
          { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: ['provider-1'] },
          { id: 'group-3', label: 'User Group Three', role: 'User', aiProviderIds: ['provider-2'] },
        ],
      },
    });
    mockUseGetAvailableModels.mockReturnValue({
      data: {
        availableModels: [
          { id: 'model-1', aiProviderId: 'provider-1', providerLabel: 'Bedrock' },
          { id: 'model-2', aiProviderId: 'provider-2', providerLabel: 'Bedrock#2' },
        ],
      },
    });
    renderModal(false);

    fireEvent.click(screen.getByTestId('user-group-attribution-modal-trigger'));

    expect(screen.getByTestId('user-group-attribution-modal-overlapping-provider-provider-1')).toHaveTextContent('Bedrock');
    expect(screen.getByTestId('user-group-attribution-modal-overlapping-provider-provider-2')).toHaveTextContent('Bedrock#2');
  });

  it('badges each provider with every user group that grants it', () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1', 'provider-2'] },
          { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: ['provider-1'] },
          { id: 'group-3', label: 'User Group Three', role: 'User', aiProviderIds: ['provider-2'] },
        ],
      },
    });
    mockUseGetAvailableModels.mockReturnValue({
      data: {
        availableModels: [
          { id: 'model-1', aiProviderId: 'provider-1', providerLabel: 'Bedrock' },
          { id: 'model-2', aiProviderId: 'provider-2', providerLabel: 'Bedrock#2' },
        ],
      },
    });
    renderModal(false);

    fireEvent.click(screen.getByTestId('user-group-attribution-modal-trigger'));

    expect(screen.getByTestId('user-group-attribution-modal-overlapping-provider-provider-1-group-group-1')).toHaveTextContent('User Group One');
    expect(screen.getByTestId('user-group-attribution-modal-overlapping-provider-provider-1-group-group-2')).toHaveTextContent('User Group Two');
    expect(screen.queryByTestId('user-group-attribution-modal-overlapping-provider-provider-1-group-group-3')).not.toBeInTheDocument();

    expect(screen.getByTestId('user-group-attribution-modal-overlapping-provider-provider-2-group-group-1')).toHaveTextContent('User Group One');
    expect(screen.getByTestId('user-group-attribution-modal-overlapping-provider-provider-2-group-group-3')).toHaveTextContent('User Group Three');
    expect(screen.queryByTestId('user-group-attribution-modal-overlapping-provider-provider-2-group-group-2')).not.toBeInTheDocument();
  });

  it('falls back to the raw provider id when it has no matching label (e.g. an embeddings-only provider)', () => {
    mockUseGetUserGroups.mockReturnValue({ data: { userGroups: twoGroups } });
    mockUseGetAvailableModels.mockReturnValue({ data: { availableModels: [] } });
    renderModal(false);

    fireEvent.click(screen.getByTestId('user-group-attribution-modal-trigger'));

    expect(screen.getByTestId('user-group-attribution-modal-overlapping-provider-provider-1')).toHaveTextContent('provider-1');
  });

  it('exposes aria-expanded and a dynamic aria-label reflecting the current group', () => {
    renderModal(false);
    const trigger = screen.getByTestId('user-group-attribution-modal-trigger');

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-label', 'AI usage attribution, currently not set');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('force-opens the modal when a pending decision is triggered from elsewhere, even without a manual click', () => {
    renderModal(false);

    expect(screen.queryByTestId('user-group-attribution-modal-select')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('trigger-gate'));

    expect(screen.getByTestId('user-group-attribution-modal-select')).toBeInTheDocument();
    expect(screen.getByTestId('user-group-attribution-modal-needs-decision-warning')).toBeInTheDocument();
  });

  it('resolves the pending decision and closes it once a group is chosen and confirmed', () => {
    renderModal(false);

    fireEvent.click(screen.getByTestId('trigger-gate'));
    fireEvent.mouseDown(screen.getByTestId('user-group-attribution-modal-select'));
    chooseAndSubmit('user-group-attribution-modal-option-group-2');

    expect(screen.queryByTestId('user-group-attribution-modal-needs-decision-warning')).not.toBeInTheDocument();
    expect(screen.getByTestId('user-group-attribution-modal-value')).toHaveTextContent('User Group Two');
  });

  it('clears a stale draft selection when a pending decision appears while the idle modal is already open', () => {
    mockUseGetUserGroups.mockReturnValue({
      data: {
        userGroups: [
          { id: 'group-1', label: 'User Group One', role: 'User', aiProviderIds: ['provider-1'] },
          { id: 'group-2', label: 'User Group Two', role: 'User', aiProviderIds: ['provider-1', 'provider-2'] },
          { id: 'group-3', label: 'User Group Three', role: 'User', aiProviderIds: ['provider-2'] },
        ],
      },
    });
    renderModal(false, 'model-1'); // model-1 -> provider-1, so gate() narrows to group-1 and group-2 only

    fireEvent.click(screen.getByTestId('user-group-attribution-modal-trigger'));
    fireEvent.mouseDown(screen.getByTestId('user-group-attribution-modal-select'));
    fireEvent.mouseDown(screen.getByTestId('user-group-attribution-modal-option-group-3'));

    fireEvent.click(screen.getByTestId('trigger-gate'));

    expect(screen.getByTestId('user-group-attribution-modal-needs-decision-warning')).toBeInTheDocument();
    expect(screen.getByTestId('user-group-attribution-modal-submit')).toBeDisabled();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    renderModal(false);
    const trigger = screen.getByTestId('user-group-attribution-modal-trigger');

    fireEvent.click(trigger);
    expect(screen.getByTestId('user-group-attribution-modal-select')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId('user-group-attribution-modal-select'), { key: 'Escape' });

    expect(trigger).toHaveFocus();
  });

  describe('audit tracking', () => {
    it('records opening the modal via the trigger button as a Toggle event', () => {
      renderModal(false);

      fireEvent.click(screen.getByTestId('user-group-attribution-modal-trigger'));

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.UserGroupAttributionModalToggle,
        label: 'opened the AI usage & cost attribution control',
      });
    });

    it('records closing the modal via the trigger button as a Toggle event too', () => {
      renderModal(false);
      const trigger = screen.getByTestId('user-group-attribution-modal-trigger');

      fireEvent.click(trigger);
      mockCreateAuditRecord.mockClear();
      fireEvent.click(trigger);

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.UserGroupAttributionModalToggle,
        label: 'closed the AI usage & cost attribution control',
      });
    });

    it('does not record a Toggle event when the modal is force-opened by a pending decision', () => {
      renderModal(false);

      fireEvent.click(screen.getByTestId('trigger-gate'));

      expect(mockCreateAuditRecord).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: AuditRecordEvent.UserGroupAttributionModalToggle }),
      );
    });

    it('records setting the default group from the idle "manage default" select as a SelectGroup event', () => {
      renderModal(false);

      openSelect();
      chooseAndSubmit('user-group-attribution-modal-option-group-1');

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.UserGroupAttributionModalSelectGroup,
        label: 'set their default user group to "User Group One"',
      });
    });

    it('records resolving a forced attribution decision as a SelectGroup event too', () => {
      renderModal(false);

      fireEvent.click(screen.getByTestId('trigger-gate'));
      fireEvent.mouseDown(screen.getByTestId('user-group-attribution-modal-select'));
      chooseAndSubmit('user-group-attribution-modal-option-group-2');

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.UserGroupAttributionModalSelectGroup,
        label: 'selected "User Group Two" for this session\'s user group attribution',
      });
    });

    it('records dismissing a forced attribution decision via Escape as a Close event', () => {
      renderModal(false);

      fireEvent.click(screen.getByTestId('trigger-gate'));
      fireEvent.keyDown(screen.getByTestId('user-group-attribution-modal-select'), { key: 'Escape' });

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.UserGroupAttributionModalClose,
        label: 'dismissed the user group attribution prompt without selecting a group',
      });
    });

    it('records simply closing the idle "manage default" modal as a plain Close, not a dismissal', () => {
      renderModal(false);

      fireEvent.click(screen.getByTestId('user-group-attribution-modal-trigger'));
      fireEvent.keyDown(screen.getByTestId('user-group-attribution-modal-select'), { key: 'Escape' });

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.UserGroupAttributionModalClose,
        label: 'closed the AI usage & cost attribution control',
      });
      expect(mockCreateAuditRecord).not.toHaveBeenCalledWith(
        expect.objectContaining({ label: 'dismissed the user group attribution prompt without selecting a group' }),
      );
    });

    it('records the Cancel button click as the same Close event', () => {
      renderModal(false);

      fireEvent.click(screen.getByTestId('user-group-attribution-modal-trigger'));
      fireEvent.click(screen.getByTestId('user-group-attribution-modal-cancel'));

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.UserGroupAttributionModalClose,
        label: 'closed the AI usage & cost attribution control',
      });
    });

  });
});
