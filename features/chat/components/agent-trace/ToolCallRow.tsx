import { useState } from 'react';
import { Box, Text, UnstyledButton, Badge, Collapse, Button, Code, useMantineTheme, Stack } from '@mantine/core';

import { IconX, IconChevronRight } from '@tabler/icons-react';

import { AgentTraceStep, AgentTraceStepType, AgentTraceStepStatus } from '@/features/chat/types/agent-trace';
import { isArtifactToolName } from '@/features/chat/utils/chatHelperFunctions';
import ToolResultCard from './ToolResultCard';

type ToolCallRowProps = Readonly<{
  step: AgentTraceStep;
  isChild?: boolean;
  elapsedMs?: number;
}>;

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatTokens(tokens: number): string {
  if (tokens < 1000) {
    return `${tokens}`;
  }
  return `${(tokens / 1000).toFixed(1)}K`;
}

function buildChildSummary(children: AgentTraceStep[]): string {
  const searchCount = children.filter((c) => c.toolName === 'search' || c.toolName === 'cypher_query').length;
  const totalSources = children.reduce((sum, c) => sum + (c.resultCount || 0), 0);
  const parts: string[] = [];
  if (searchCount > 0) {
    parts.push(`${searchCount} ${searchCount === 1 ? 'search' : 'searches'}`);
  }
  if (totalSources > 0) {
    parts.push(`${totalSources} ${totalSources === 1 ? 'source' : 'sources'}`);
  }
  return parts.join(' · ');
}

export default function ToolCallRow({ step, isChild = false, elapsedMs }: ToolCallRowProps) {
  const theme = useMantineTheme();
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const isThinking = step.type === AgentTraceStepType.Thinking;
  const isWriting = step.type === AgentTraceStepType.Writing;
  const isPlainLabel = isThinking || isWriting || !step.toolName;
  const suppressTag = isPlainLabel;
  const isRunning = step.status === AgentTraceStepStatus.Running;
  const hasError = step.status === AgentTraceStepStatus.Error;

  const hasChildren = (isThinking || isWriting) && step.children && step.children.length > 0;
  const hasExpandableContent =
    hasChildren ||
    (step.results && step.results.length > 0) ||
    !!step.rawOutput;

  const childSummary = hasChildren && !expanded && step.children ? buildChildSummary(step.children) : '';

  const inlineContent = (
    <Box>
      {hasChildren && step.children && (
        <Stack spacing={2} mt={2}>
          {step.children.map((child) => (
            <ToolCallRow key={child.id} step={child} isChild />
          ))}
        </Stack>
      )}

      {!hasChildren && step.results && step.results.length > 0 && (
        <Box mt={4}>
          <ToolResultCard
            results={step.results}
            asList={step.toolName === 'get_library_documents'}
            isSearch={step.toolName === 'search' || step.toolName === 'cypher_query'}
          />
        </Box>
      )}

      {!!step.rawOutput && (
        <Box
          mt='xs'
          pl='md'
          py='xs'
          sx={(t) => ({
            borderLeft: `1.5px solid ${t.colors.dark[4]}`,
          })}
        >
          <Button
            variant='subtle'
            size='xs'
            onClick={() => setShowRaw(!showRaw)}
            mb={showRaw ? 'xs' : 0}
          >
            {showRaw ? 'Hide' : 'View'} raw response
          </Button>
          {showRaw && (
            <Code
              block
              sx={{
                fontSize: 11,
                maxHeight: 300,
                overflowY: 'auto',
              }}
            >
              {JSON.stringify(step.rawOutput, null, 2)}
            </Code>
          )}
        </Box>
      )}
    </Box>
  );

  return (
    <Box pl={isChild ? 'md' : 0}>
      <UnstyledButton
        onClick={() => {
          if (hasExpandableContent) {
            setExpanded(!expanded);
          }
        }}
        sx={(t) => ({
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 0',
          cursor: hasExpandableContent ? 'pointer' : 'default',
          '&:hover': hasExpandableContent
            ? { '& .chevron': { color: t.colors.gray[3] } }
            : {},
        })}
      >
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
          {step.toolName && !suppressTag && (
            <Code
              sx={{
                fontSize: 11,
                color: 'var(--mantine-color-gray-5)',
                backgroundColor: 'transparent',
                padding: '0 4px',
                flexShrink: 0,
              }}
            >
              {step.toolName}
            </Code>
          )}

          {step.toolName !== 'get_library_documents' && (
            <Text
              size='sm'
              c={isThinking ? 'gray.5' : 'gray.4'}
              sx={{ minWidth: 0, flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {isPlainLabel
                ? (step.toolLabel || 'Tool call')
                : step.toolLabel
                  ? <em>{'"'}{step.toolLabel}{'"'}</em>
                  : null
              }
            </Text>
          )}

          {childSummary && (
            <>
              <Text size='xs' c='dimmed' style={{ flexShrink: 0 }}>·</Text>
              <Text size='xs' c='dimmed' style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {childSummary}
              </Text>
            </>
          )}

          {!isThinking && step.resultCount !== undefined && step.resultCount > 0 && (
            <>
              <Text size='xs' c='dimmed' style={{ flexShrink: 0 }}>·</Text>
              <Text size='xs' c='dimmed' style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {isArtifactToolName(step.toolName)
                  ? `${step.resultCount} ${step.resultCount === 1 ? 'artifact' : 'artifacts'}`
                  : (step.toolName === 'search' || step.toolName === 'cypher_query') && (step.chunks !== undefined || step.entities !== undefined || step.concepts !== undefined)
                    ? [
                        step.chunks !== undefined && step.chunks > 0 ? `${step.chunks} ${step.chunks === 1 ? 'chunk' : 'chunks'}` : null,
                        step.entities !== undefined && step.entities > 0 ? `${step.entities} ${step.entities === 1 ? 'entity' : 'entities'}` : null,
                        step.concepts !== undefined && step.concepts > 0 ? `${step.concepts} ${step.concepts === 1 ? 'concept' : 'concepts'}` : null,
                      ].filter(Boolean).join(', ') || `${step.resultCount} found`
                    : (step.toolName === 'search' || step.toolName === 'cypher_query')
                      ? `${step.resultCount} ${step.resultCount === 1 ? 'node' : 'nodes'} found`
                      : `${step.resultCount} ${step.resultCount === 1 ? 'source' : 'sources'}`
                }
              </Text>
            </>
          )}

          <Box sx={{ flex: 1 }} />

          {step.model && (
            <Badge
              size='xs'
              variant='filled'
              sx={(t) => ({
                backgroundColor: t.colors.dark[5],
                color: t.colors.gray[3],
                fontWeight: 400,
                textTransform: 'none',
              })}
            >
              {step.model}
            </Badge>
          )}

          {(step.inputTokens !== undefined || step.outputTokens !== undefined) && (
            <Text size='xs' c='gray.5' style={{ fontVariantNumeric: 'tabular-nums' }}>
              {step.inputTokens !== undefined && `${formatTokens(step.inputTokens)} in`}
              {step.inputTokens !== undefined && step.outputTokens !== undefined && ' · '}
              {step.outputTokens !== undefined && `${formatTokens(step.outputTokens)} out`}
            </Text>
          )}

          {(step.durationMs !== undefined || elapsedMs !== undefined) && (
            <Text size='xs' c='gray.7' style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatDuration(step.durationMs ?? elapsedMs!)}
            </Text>
          )}

          {hasError && (
            <IconX
              size={14}
              style={{
                color: theme.colors.red[5],
                flexShrink: 0,
              }}
            />
          )}

          {hasExpandableContent && (
            <IconChevronRight
              size={14}
              className='chevron'
              style={{
                color: 'var(--mantine-color-gray-5)',
                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 150ms ease',
                flexShrink: 0,
              }}
            />
          )}
        </Box>
      </UnstyledButton>

      <Collapse in={expanded}>
        {inlineContent}
      </Collapse>

    </Box>
  );
}
