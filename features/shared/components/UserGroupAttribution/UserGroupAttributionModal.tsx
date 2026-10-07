import { ComponentPropsWithoutRef, forwardRef, useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  List,
  Modal,
  Select,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  useMantineTheme,
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { IconChevronDown, IconChevronUp, IconUsers } from '@tabler/icons-react';
import { z } from 'zod';

import { useUserGroupAttributionContext } from '@/features/shared/providers/UserGroupAttribution/UserGroupAttributionProvider';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

const attributionFormSchema = z.object({
  userGroupId: z.string().min(1, 'A user group is required'),
});
const validateAttributionForm = zodResolver(attributionFormSchema);

type AttributionFormValues = z.infer<typeof attributionFormSchema>;

type UserGroupAttributionModalProps = Readonly<{
  isCollapsed: boolean;
}>;

type GroupSelectItemProps = ComponentPropsWithoutRef<'div'> & {
  value: string;
  label: string;
};

const GroupSelectItem = forwardRef<HTMLDivElement, GroupSelectItemProps>(
  ({ value, label, ...others }, ref) => (
    <div ref={ref} data-testid={`user-group-attribution-modal-option-${value}`} {...others}>
      <Text size='sm'>{label}</Text>
    </div>
  ),
);
GroupSelectItem.displayName = 'GroupSelectItem';

// Hidden unless the user belongs to 2+ groups that each grant some AI provider access,
// computed account-wide rather than scoped to whichever page is currently mounted.
export default function UserGroupAttributionModal({ isCollapsed }: UserGroupAttributionModalProps) {
  const theme = useMantineTheme();
  const {
    pendingDecision,
    idleGroups,
    idleDefaultUserGroupId,
    defaultUserGroupId,
    setDefaultUserGroupId,
    onSelect,
    onDismiss,
    overlappingAiProviders,
    isUserGroupAttributionControlVisible,
    singleUserGroup,
    nonOverlappingUserGroups,
  } = useUserGroupAttributionContext();
  const track = useTrackClientEvent();

  const [manuallyOpened, setManuallyOpened] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const groups = pendingDecision?.groups ?? idleGroups;
  const needsDecision = Boolean(pendingDecision);
  const opened = needsDecision || manuallyOpened;

  // Draft selection made in the Select while the modal is open — only committed to context
  // (and localStorage) on Submit, so Cancel/click-outside/Escape can discard it for free.
  const form = useForm<AttributionFormValues>({
    initialValues: { userGroupId: '' },
    validate: validateAttributionForm,
  });
  const { setFieldValue, clearErrors } = form;

  // Re-syncs the draft to the current target default whenever the modal is open, so a
  // pendingDecision appearing while the modal is already open (no open/close transition
  // to hook into) can't leave a stale, unvalidated selection behind. While needsDecision,
  // idleDefaultUserGroupId (validated only against the account-wide idle set) must also be
  // re-validated against this specific decision's `groups`, since a default can be eligible
  // account-wide without being eligible for the source that triggered this pendingDecision.
  useEffect(() => {
    if (!opened) {
      return;
    }
    const target = needsDecision
      ? (idleDefaultUserGroupId && groups.some((group) => group.id === idleDefaultUserGroupId) ? idleDefaultUserGroupId : undefined)
      : defaultUserGroupId;
    setFieldValue('userGroupId', target ?? '');
    clearErrors();
  }, [opened, needsDecision, idleDefaultUserGroupId, defaultUserGroupId, groups, setFieldValue, clearErrors]);

  if (!isUserGroupAttributionControlVisible) {
    return null;
  }

  // Shared shell for the read-only info states below (single group, non-overlapping groups) —
  // same icon/tooltip presentation, differing only in what text they show.
  const renderReadOnlyIndicator = (testIdPrefix: string, tooltipLabel: string, label: string) => {
    const indicator = isCollapsed ? (
      <ActionIcon
        data-testid={`${testIdPrefix}-indicator`}
        aria-label={tooltipLabel}
        size={40}
        variant='subtle'
        color='gray'
        sx={(t) => ({ borderRadius: t.radius.sm, cursor: 'default' })}
      >
        <IconUsers stroke={1.5} size={20} color={theme.colors.teal[4]} />
      </ActionIcon>
    ) : (
      <Group
        spacing='sm'
        data-testid={`${testIdPrefix}-indicator`}
        sx={(t) => ({ width: '100%', height: 38, padding: `0 ${t.spacing.sm}` })}
      >
        <IconUsers stroke={1.5} size={18} color={theme.colors.teal[4]} style={{ flexShrink: 0 }} />
        <Text
          data-testid={`${testIdPrefix}-label`}
          size='sm'
          color='gray.3'
          sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {label}
        </Text>
      </Group>
    );

    return (
      <div style={isCollapsed ? { display: 'flex', justifyContent: 'center' } : undefined}>
        <Tooltip label={tooltipLabel} position='right' openDelay={0} zIndex={1000} withinPortal>
          <div>{indicator}</div>
        </Tooltip>
      </div>
    );
  };

  // A single group membership can never be ambiguous, so there's nothing to choose — just a
  // read-only indicator naming the group, with no trigger, select, or modal behind it.
  if (singleUserGroup) {
    return renderReadOnlyIndicator(
      'user-group-attribution-single-group',
      `Member of the ${singleUserGroup.label} user group`,
      singleUserGroup.label,
    );
  }

  // 2+ groups but none share AI provider access with another — every membership is
  // unambiguous, so this is read-only too, just naming a count instead of a single group.
  if (nonOverlappingUserGroups) {
    return renderReadOnlyIndicator(
      'user-group-attribution-multi-group',
      `Member of ${nonOverlappingUserGroups.length} user groups: ${nonOverlappingUserGroups.map((group) => group.label).join(', ')}`,
      `Member of ${nonOverlappingUserGroups.length} user groups`,
    );
  }

  // needsDecision must keep showing the suppressed value (idleDefaultUserGroupId) so a stale
  // pre-fill can't silently satisfy this session's re-prompt without the user actually choosing.
  // Everywhere else, echo the raw stored default — this is the "manage your default" surface.
  const selectedGroup = groups.find((group) => group.id === (needsDecision ? idleDefaultUserGroupId : defaultUserGroupId));
  const hasDefault = Boolean(selectedGroup);
  const submitDisabled = needsDecision
    ? !form.values.userGroupId
    : !form.values.userGroupId || form.values.userGroupId === defaultUserGroupId;

  const close = () => {
    if (needsDecision) {
      track.userUserGroupAttributionModal.close('dismissed the user group attribution prompt without selecting a group');
      onDismiss();
    } else {
      track.userUserGroupAttributionModal.close('closed the AI usage & cost attribution control');
    }
    setManuallyOpened(false);
    triggerRef.current?.focus();
  };

  const handleTriggerClick = () => {
    if (needsDecision) {
      return;
    }
    track.userUserGroupAttributionModal.toggle(
      manuallyOpened ? 'closed the AI usage & cost attribution control' : 'opened the AI usage & cost attribution control',
    );
    setManuallyOpened((prev) => !prev);
  };

  const handleSubmit = (values: AttributionFormValues) => {
    const groupLabel = groups.find((group) => group.id === values.userGroupId)?.label ?? values.userGroupId;

    if (needsDecision) {
      track.userUserGroupAttributionModal.selectGroup(`selected "${groupLabel}" for this session's user group attribution`);
      onSelect(values.userGroupId);
      return;
    }

    track.userUserGroupAttributionModal.selectGroup(`set their default user group to "${groupLabel}"`);
    setDefaultUserGroupId(values.userGroupId);
    setManuallyOpened(false);
    triggerRef.current?.focus();
  };

  const ariaLabel = `AI usage attribution, currently ${selectedGroup ? selectedGroup.label : 'not set'}`;
  const iconColor = hasDefault ? theme.colors.teal[4] : theme.colors.orange[4];

  const trigger = isCollapsed ? (
    <ActionIcon
      ref={triggerRef}
      onClick={handleTriggerClick}
      data-testid='user-group-attribution-modal-trigger'
      aria-haspopup='dialog'
      aria-expanded={opened}
      aria-label={ariaLabel}
      size={40}
      variant='subtle'
      color='gray'
      sx={(t) => ({ borderRadius: t.radius.sm })}
    >
      <IconUsers stroke={1.5} size={20} color={iconColor} />
    </ActionIcon>
  ) : (
    <UnstyledButton
      ref={triggerRef}
      onClick={handleTriggerClick}
      data-testid='user-group-attribution-modal-trigger'
      aria-haspopup='dialog'
      aria-expanded={opened}
      aria-label={ariaLabel}
      sx={(t) => ({
        display: 'flex',
        alignItems: 'center',
        gap: t.spacing.sm,
        width: '100%',
        height: 38,
        padding: `0 ${t.spacing.sm}`,
        borderRadius: t.radius.sm,
        color: t.colors.gray[4],
        '&:hover': {
          backgroundColor: t.colors.dark[6],
        },
      })}
    >
      <IconUsers stroke={1.5} size={18} color={iconColor} style={{ flexShrink: 0 }} />
      {hasDefault ? (
        <Text
          data-testid='user-group-attribution-modal-value'
          size='sm'
          color='gray.3'
          sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {selectedGroup!.label}
        </Text>
      ) : (
        <Badge
          data-testid='user-group-attribution-modal-value'
          size='sm'
          color='orange'
          variant='light'
          sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start' }}
        >
          Set default user group
        </Badge>
      )}
      {opened ? (
        <IconChevronUp size={16} color={theme.colors.gray[6]} style={{ flexShrink: 0 }} />
      ) : (
        <IconChevronDown size={16} color={theme.colors.gray[6]} style={{ flexShrink: 0 }} />
      )}
    </UnstyledButton>
  );

  const tooltipLabel = hasDefault
    ? `AI usage billed to ${selectedGroup!.label} in cases of overlapping resource access`
    : 'Select a default user group for AI usage attribution';

  return (
    <div style={isCollapsed ? { display: 'flex', justifyContent: 'center' } : undefined}>
      {isCollapsed ? (
        <Tooltip label={tooltipLabel} position='right' openDelay={0} zIndex={1000} withinPortal>
          <div>{trigger}</div>
        </Tooltip>
      ) : trigger}

      <Modal
        opened={opened}
        onClose={close}
        title='AI usage & cost attribution'
        withCloseButton={false}
        closeOnClickOutside={false}
        centered
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack spacing='sm' mb='md'>
            <Text size='sm' color='gray.7'>
              Your user group memberships give you overlapping access to AI resources:
            </Text>
            <List size='sm' spacing='xs' c='gray.7' style={{ listStyleType: 'disc' }}>
              {overlappingAiProviders.map((provider) => (
                <List.Item key={provider.id} data-testid={`user-group-attribution-modal-overlapping-provider-${provider.id}`}>
                  <Group spacing='xs' align='center'>
                    <Text component='span' weight={700} color='gray.1'>
                      {provider.name}
                    </Text>
                    {provider.groups.map((group) => (
                      <Badge
                        key={group.id}
                        data-testid={`user-group-attribution-modal-overlapping-provider-${provider.id}-group-${group.id}`}
                        size='sm'
                        variant='light'
                        color='blue'
                      >
                        {group.label}
                      </Badge>
                    ))}
                  </Group>
                </List.Item>
              ))}
            </List>

            <Text
              data-testid={needsDecision ? 'user-group-attribution-modal-needs-decision-warning' : undefined}
              size='sm'
              color='gray.7'
            >
              Choose which user group your AI usage should be attributed to when this occurs. You can change this setting at any time.
            </Text>
          </Stack>

          <Select
            data-testid='user-group-attribution-modal-select'
            label={!hasDefault && !needsDecision ? 'Set default user group' : 'Default user group'}
            required={hasDefault || needsDecision}
            data={groups.map((group) => ({ value: group.id, label: group.label }))}
            value={form.values.userGroupId || null}
            onChange={(value) => setFieldValue('userGroupId', value ?? '')}
            placeholder='Select a user group'
            itemComponent={GroupSelectItem}
          />

          <Group spacing='lg' grow>
            <Button type='button' data-testid='user-group-attribution-modal-cancel' variant='outline' onClick={close}>
              Cancel
            </Button>
            <Button type='submit' data-testid='user-group-attribution-modal-submit' disabled={submitDisabled}>
              {needsDecision ? 'Confirm' : 'Save'}
            </Button>
          </Group>
        </form>
      </Modal>
    </div>
  );
}
