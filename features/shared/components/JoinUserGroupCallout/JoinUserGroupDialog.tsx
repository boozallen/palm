import {
  ActionIcon,
  Anchor,
  Box,
  Button,
  Dialog,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  useMantineTheme,
} from '@mantine/core';
import {
  IconBook2,
  IconChevronDown,
  IconChevronUp,
  IconFileUpload,
  IconLockOpen,
  IconSparkles,
} from '@tabler/icons-react';
import React, { useEffect, useRef } from 'react';

import JoinUserGroupForm from '@/features/profile/components/forms/JoinUserGroupForm';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetWorkspaceStats from '@/features/shared/api/get-workspace-stats';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

type JoinUserGroupDialogProps = Readonly<{
  opened: boolean;
  collapsed: boolean;
  focusRequestId: number;
  onCollapse: () => void;
  onExpand: () => void;
}>;

export default function JoinUserGroupDialog({
  opened,
  collapsed,
  focusRequestId,
  onCollapse,
  onExpand,
}: JoinUserGroupDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const theme = useMantineTheme();

  const { data: stats } = useGetWorkspaceStats();
  const { data: systemConfig } = useGetSystemConfig();
  const track = useTrackClientEvent();

  const requestAccessUrl = systemConfig?.joinUserGroupDialogExternalLink ?? '';

  // The link opens in a new tab, so the click is not intercepted; both records
  // are fired alongside it. They answer different questions and are tracked
  // separately: EXTERNAL_NAVIGATION counts the click as a link leaving the app
  // (Context Studio behavior views), REQUEST_ACCESS_TO_PALM counts it as an
  // access-request intent (governance).
  const handleRequestAccessClick = () => {
    track.externalLink('see how to get access', requestAccessUrl);
    track.requestAccess('Join User Group Dialog', requestAccessUrl);
  };

  const chatsLast30Days = stats?.chatsLast30Days ?? 0;
  const documentsUploadedLast30Days = stats?.documentsUploadedLast30Days ?? 0;
  const artifactsGeneratedLast30Days = stats?.artifactsGeneratedLast30Days ?? 0;
  const citationsGeneratedLast30Days = stats?.citationsGeneratedLast30Days ?? 0;

  const benefits = [
    { key: 'chat', icon: IconSparkles, label: 'Use approved LLMs from AWS Bedrock' },
    { key: 'documents', icon: IconFileUpload, label: 'Analyze documents with RAG and GraphRAG' },
    {
      key: 'prompts',
      icon: IconBook2,
      label: 'Access to reusable prompts, agents, and skills',
    },
  ];

  const activityMetrics = [
    { key: 'chats', value: chatsLast30Days, label: 'chat conversations' },
    { key: 'documents', value: documentsUploadedLast30Days, label: 'documents uploaded' },
    { key: 'artifacts', value: artifactsGeneratedLast30Days, label: 'artifacts generated' },
    { key: 'citations', value: citationsGeneratedLast30Days, label: 'citations generated' },
  ];

  useEffect(() => {
    if (!opened || collapsed) {
      return;
    }

    // Wait for the slide-up transition to mount the input before focusing.
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [focusRequestId, collapsed, opened]);

  return (
    <Dialog
      opened={opened}
      data-testid='join-user-group-dialog'
      size='lg'
      radius='sm'
      shadow='xl'
      p={collapsed ? 0 : 'md'}
      position={{ bottom: theme.spacing.md, right: theme.spacing.md }}
      transition='slide-up'
      sx={(theme) => ({
        ...(collapsed
          ? {
              backgroundColor: 'transparent',
              border: 'none',
              boxShadow: 'none',
              width: 'fit-content',
              minWidth: 'unset',
            }
          : {
              backgroundColor: theme.colors.dark[6],
              border: `1px solid ${theme.colors.dark[4]}`,
              borderTop: `3px solid ${theme.colors.orange[6]}`,
            }),
      })}
    >
      {collapsed ? (
        <Button
          onClick={onExpand}
          data-testid='join-user-group-dialog-expand'
          variant='default'
          radius='sm'
          leftIcon={
            <ThemeIcon
              size='sm'
              radius='sm'
              variant='light'
              sx={(theme) => ({
                backgroundColor: theme.fn.rgba(theme.colors.orange[6], 0.15),
                color: theme.colors.orange[4],
              })}
            >
              <IconLockOpen size={14} />
            </ThemeIcon>
          }
          rightIcon={<IconChevronUp size={16} />}
          styles={(theme) => ({
            root: {
              height: 'auto',
              padding: `${theme.spacing.md} ${theme.spacing.md}`,
              backgroundColor: theme.colors.dark[6],
              borderTop: `3px solid ${theme.colors.orange[6]}`,
            },
            label: {
              color: theme.white,
              fontWeight: 600,
            },
          })}
        >
          <Text size='sm' data-testid='join-user-group-dialog-collapsed-label'>
            Get started with PALM
          </Text>
        </Button>
      ) : (
        <>
          <Group align='center' noWrap position='apart'>
            <Group align='center' spacing='xxs' noWrap mb='sm'>
              <ThemeIcon
                size='md'
                radius='sm'
                ml='-xs'
                variant='light'
                sx={(theme) => ({
                  backgroundColor: theme.fn.rgba(theme.colors.orange[6], 0.15),
                  color: theme.colors.orange[4],
                })}
              >
                <IconLockOpen size={18} />
              </ThemeIcon>
              <Title order={4} color='white' data-testid='join-user-group-dialog-title'>
                Get started with PALM
              </Title>
            </Group>
            <ActionIcon
              onClick={onCollapse}
              data-testid='join-user-group-dialog-collapse'
              aria-label='Collapse'
              variant='subtle'
              color='gray'
            >
              <IconChevronDown size={18} />
            </ActionIcon>
          </Group>

          <Stack spacing='sm'>
            {benefits.map(({ key, icon: Icon, label }) => (
              <Group
                key={key}
                data-testid={`join-user-group-dialog-benefit-${key}`}
                spacing='sm'
                align='center'
                noWrap
              >
                <ThemeIcon
                  size='sm'
                  radius='sm'
                  variant='light'
                  sx={(theme) => ({
                    backgroundColor: theme.fn.rgba(theme.colors.orange[6], 0.15),
                    color: theme.colors.orange[4],
                  })}
                >
                  <Icon size={14} />
                </ThemeIcon>
                <Text size='sm' color='gray.3'>
                  {label}
                </Text>
              </Group>
            ))}

            {stats && (
              <Box
                mb='sm'
                p='sm'
                data-testid='join-user-group-dialog-activity'
                sx={(theme) => ({
                  borderRadius: theme.radius.sm,
                  backgroundColor: theme.fn.rgba(theme.colors.orange[6], 0.08),
                  border: `1px solid ${theme.fn.rgba(theme.colors.orange[6], 0.2)}`,
                })}
              >
                <Text size='xs' weight={600} color='orange.4' transform='uppercase' mb={6}>
                  Last 30 days&apos; activity
                </Text>
                <SimpleGrid cols={2} spacing='xs' verticalSpacing={4}>
                  {activityMetrics.map((metric) => (
                    <Group
                      key={metric.key}
                      data-testid={`join-user-group-dialog-activity-${metric.key}`}
                      spacing={6}
                      align='baseline'
                      noWrap
                    >
                      <Text size='sm' weight={700} color='white'>
                        {metric.value.toLocaleString()}
                      </Text>
                      <Text size='xs' color='gray.4'>
                        {metric.label}
                      </Text>
                    </Group>
                  ))}
                </SimpleGrid>
              </Box>
            )}

            <Box>
              <JoinUserGroupForm ref={inputRef} />
            </Box>

            {requestAccessUrl && (
              <Text size='xs' color='gray.4' mt='sm' data-testid='join-user-group-dialog-help'>
                No join code? Submit an AI Risk Trigger request to get approved —{' '}
                <Anchor
                  href={requestAccessUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  color='orange.4'
                  onClick={handleRequestAccessClick}
                  data-testid='join-user-group-dialog-get-access-link'
                  inherit
                >
                  see how to get access
                </Anchor>
              </Text>
            )}
          </Stack>
        </>
      )}
    </Dialog>
  );
}
