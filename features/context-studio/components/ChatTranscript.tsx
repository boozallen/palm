// The read-only transcript renderer. Two callers — the Conversations table's row
// expansion and the Value tab's category drawer — so it lives here rather than
// inside the dashboard that grew it.

import { Fragment, useState } from 'react';
import {
  Box,
  Group,
  Stack,
  Text,
} from '@mantine/core';
import HoverPopover from './HoverPopover';
import { formatTokens } from '@/features/context-studio/utils/valueFormat';

export type UsageStepRecord = {
  stepLabel: string;
  cost: number;
  tokens: number;
};

export type ChatMessageRecord = {
  role: string;
  content: string;
  createdAt: string | Date;
  usageSteps: UsageStepRecord[];
};

const formatExactSpend = (spend: number): string => {
  if (spend === 0) { return '$0.00'; }
  const decimals = spend.toFixed(6).replace(/0+$/, '').split('.')[1]?.length ?? 0;
  return `$${spend.toFixed(Math.max(decimals, 2))}`;
};

function getStepLabelText(label: string): string {
  if (label === 'plan') { return 'Plan'; }
  if (label === 'response') { return 'Response'; }
  return label.replace(/\+/g, ' + ');
}

function StepLabel({ label }: { label: string }) {
  return <>{getStepLabelText(label)}</>;
}

function getStepDescription(label: string): string {
  if (label === 'plan') {
    return 'The model reasoned through how to approach the request before producing any output.';
  }
  if (label === 'response') {
    return 'Generating the final reply shown to the user.';
  }
  return 'One step in a multi-step tool-calling sequence, combining the tools listed in its name.';
}

export function MessageBubble({ msg, userName }: { msg: ChatMessageRecord; userName: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = msg.content.length > 500;
  const isAssistant = msg.role === 'assistant';

  return (
    <Stack spacing={4} data-testid='chat-transcript-message'>
      <Text size='xs' fw='bold' color={isAssistant ? 'green' : 'blue'}>
        {isAssistant ? 'Assistant' : userName ?? 'User'}
      </Text>
      <Text
        size='sm'
        sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
        lineClamp={!expanded && isLong ? 4 : undefined}
      >
        {msg.content}
      </Text>
      {isLong && (
        <Text
          size='xs'
          color='blue'
          sx={{ cursor: 'pointer' }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </Text>
      )}
    </Stack>
  );
}

export function aggregateUsageSteps(messages: ChatMessageRecord[]): UsageStepRecord[] {
  const totals = new Map<string, UsageStepRecord>();
  messages.forEach((msg) => {
    msg.usageSteps.forEach((step) => {
      const existing = totals.get(step.stepLabel);
      if (existing) {
        existing.cost += step.cost;
        existing.tokens += step.tokens;
      } else {
        totals.set(step.stepLabel, { ...step });
      }
    });
  });
  return Array.from(totals.values());
}

export function CostBreakdownCard({ usageSteps }: { usageSteps: UsageStepRecord[] }) {
  const totalCost = usageSteps.reduce((s, u) => s + u.cost, 0);
  const totalTokens = usageSteps.reduce((s, u) => s + u.tokens, 0);

  return (
    <Box
      data-testid='chat-transcript-cost'
      sx={(theme) => ({
        maxWidth: 340,
        alignSelf: 'flex-start',
        backgroundColor: theme.colors.dark[6],
        border: `1px solid ${theme.colors.dark[4]}`,
        borderRadius: theme.radius.md,
        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
      })}
    >
      <Group position='apart' align='baseline' noWrap mb={10}>
        <Text size='xs' color='dimmed' sx={{ letterSpacing: '0.02em' }}>Cost breakdown</Text>
        <Text size='sm' color='gray.4' sx={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
          {formatTokens(totalTokens)} tokens
        </Text>
      </Group>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', columnGap: 14, rowGap: 9, alignItems: 'center' }}>
        {usageSteps.map((step, i) => {
          const tokenShare = totalTokens > 0 ? (step.tokens / totalTokens) * 100 : 0;
          return (
            <Fragment key={i}>
              <HoverPopover
                width={240}
                target={
                  <Text
                    size='sm'
                    color='gray.4'
                    sx={{
                      fontFamily: 'monospace',
                      cursor: 'default',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {step.stepLabel}
                  </Text>
                }
              >
                <Stack spacing={4}>
                  <Text size='sm' fw={600} color='gray.2'><StepLabel label={step.stepLabel} /></Text>
                  <Text size='xs' color='gray.4'>{getStepDescription(step.stepLabel)}</Text>
                  <Text size='xs' color='gray.5'>{formatExactSpend(step.cost)} · {formatTokens(step.tokens)} tokens</Text>
                </Stack>
              </HoverPopover>
              <Text
                size='sm'
                color='dimmed'
                align='right'
                sx={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}
              >
                {formatTokens(step.tokens)}
              </Text>
              <Text
                size='sm'
                color='gray.2'
                align='right'
                sx={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', minWidth: 44 }}
              >
                {formatExactSpend(step.cost)}
              </Text>
              <Box
                sx={(theme) => ({
                  gridColumn: '1 / -1',
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: theme.colors.dark[5],
                  overflow: 'hidden',
                })}
              >
                <Box
                  sx={(theme) => ({
                    width: `${tokenShare}%`,
                    height: '100%',
                    backgroundColor: theme.colors.cyan[5],
                    opacity: 0.55,
                  })}
                />
              </Box>
            </Fragment>
          );
        })}
      </Box>

      {usageSteps.length > 1 && (
        <Box
          sx={(theme) => ({
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            columnGap: 14,
            alignItems: 'center',
            marginTop: 11,
            paddingTop: 10,
            borderTop: `1px solid ${theme.colors.dark[4]}`,
          })}
        >
          <Text size='sm' fw={500} color='gray.2'>Total</Text>
          <Text
            size='sm'
            color='dimmed'
            align='right'
            sx={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}
          >
            {formatTokens(totalTokens)}
          </Text>
          <Text
            size='sm'
            fw={500}
            color='gray.2'
            align='right'
            sx={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', minWidth: 44 }}
          >
            {formatExactSpend(totalCost)}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default function ChatTranscript({ messages, userName }: { messages: ChatMessageRecord[]; userName: string | null }) {
  const hasChatUsage = messages.some((m) => m.usageSteps.length > 0);

  return (
    <Stack
      spacing='lg'
      sx={(theme) => ({
        maxHeight: 400,
        overflowY: 'auto',
        borderTop: `1px solid ${theme.colors.dark[4]}`,
        borderBottom: `1px solid ${theme.colors.dark[4]}`,
      })}
    >
      {messages.map((msg, i) => (
        <MessageBubble key={i} msg={msg} userName={userName} />
      ))}
      {hasChatUsage && (
        <CostBreakdownCard usageSteps={aggregateUsageSteps(messages)} />
      )}
      <Text size='xs' color='dimmed' align='center' sx={{ fontStyle: 'italic' }}>
        (end of conversation)
      </Text>
    </Stack>
  );
}
