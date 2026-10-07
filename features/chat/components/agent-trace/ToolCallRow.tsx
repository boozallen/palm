import { useState } from 'react';
import { Box, Text, UnstyledButton, Badge, Collapse, Button, Code, Paper, useMantineTheme, Stack } from '@mantine/core';

import { IconX, IconChevronRight } from '@tabler/icons-react';

import { AgentTraceStep, AgentTraceStepType, AgentTraceStepStatus } from '@/features/chat/types/agent-trace';
import { isArtifactToolName, getToolTagLabel, getCreateArtifactExtension } from '@/features/chat/utils/chatHelperFunctions';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';
import CodeBlockWithBanner from '@/features/chat/components/content/CodeBlockWithBanner';
import ToolResultCard, { InlineFileName, InlineFileGroup } from './ToolResultCard';
import EditArtifactResultRow, { ArtifactFileBadge } from './EditArtifactResultRow';

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
  const track = useTrackClientEvent();

  const isThinking = step.type === AgentTraceStepType.Thinking;
  const isWriting = step.type === AgentTraceStepType.Writing;
  const isPlainLabel = isThinking || isWriting || !step.toolName;
  const suppressTag = isPlainLabel;
  const isRunning = step.status === AgentTraceStepStatus.Running;
  const hasError = step.status === AgentTraceStepStatus.Error;

  const hasChildren = (isThinking || isWriting) && step.children && step.children.length > 0;
  const bashCommand = step.toolName === 'Bash' ? step.toolArgs?.command : undefined;
  const isSingleArtifactEdit =
    isArtifactToolName(step.toolName) &&
    !!step.toolName?.startsWith('edit_') &&
    step.results?.length === 1;
  const createExtension = getCreateArtifactExtension(step.toolName);
  const isSingleArtifactCreate = !!createExtension && step.results?.length === 1;
  const generatingArtifactTitle =
    createExtension && !step.results?.length && step.toolArgs?.title?.trim()
      ? `${step.toolArgs.title.trim()}${createExtension}`
      : undefined;
  const isLibraryDocuments = step.toolName === 'get_library_documents' && !!step.results && step.results.length > 0;
  const analyzeFilename = step.toolName === 'analyze_spreadsheet_data' ? step.toolArgs?.filename : undefined;
  const hasExpandableContent =
    hasChildren ||
    (!!step.results && step.results.length > 0 && !isSingleArtifactEdit && !isSingleArtifactCreate && !isLibraryDocuments) ||
    !!step.rawOutput ||
    !!bashCommand;

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

      {bashCommand && (
        <Paper mt='sm' withBorder radius='sm' bg='dark.9' sx={{ overflow: 'hidden' }} data-testid={`tool-call-bash-command-${step.id}`}>
          <CodeBlockWithBanner value={bashCommand} language='bash' />
        </Paper>
      )}

      {!hasChildren && !isSingleArtifactEdit && !isSingleArtifactCreate && !isLibraryDocuments && step.results && step.results.length > 0 && (
        isArtifactToolName(step.toolName) && step.toolName?.startsWith('edit_') ? (
          <EditArtifactResultRow results={step.results} diffStat={step.diffStat} />
        ) : (
          <Box mt={4}>
            <ToolResultCard
              results={step.results}
              isSearch={step.toolName === 'search' || step.toolName === 'cypher_query'}
            />
          </Box>
        )
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
            onClick={() => {
              track.togglePanel(showRaw ? 'Hide raw response' : 'View raw response');
              setShowRaw(!showRaw);
            }}
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
        component={hasExpandableContent ? 'button' : 'div'}
        data-testid={`tool-call-toggle-${step.id}`}
        onClick={() => {
          if (hasExpandableContent) {
            track.togglePanel(expanded ? 'Collapse tool call' : 'Expand tool call');
            setExpanded(!expanded);
          }
        }}
        sx={(t) => ({
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 0 0 0',
          cursor: hasExpandableContent ? 'pointer' : 'default',
          '&:hover': hasExpandableContent
            ? { '& .chevron': { color: t.colors.gray[3] } }
            : {},
        })}
      >
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
          {step.toolName && !suppressTag && (
            <Text size='xs' c='gray.8' sx={{ flexShrink: 0 }}>
              {getToolTagLabel(step.toolName)}
            </Text>
          )}

          {(isSingleArtifactEdit || isSingleArtifactCreate) && step.results ? (
            <ArtifactFileBadge result={step.results[0]} diffStat={step.diffStat} />
          ) : generatingArtifactTitle ? (
            <ArtifactFileBadge result={{ title: generatingArtifactTitle }} />
          ) : (
            <>
              {isLibraryDocuments ? (
                step.results!.length === 1 ? (
                  <InlineFileName title={step.results![0].title} />
                ) : (
                  <InlineFileGroup titles={step.results!.map((result) => result.title)} />
                )
              ) : analyzeFilename ? (
                <InlineFileName title={analyzeFilename} />
              ) : (
                !bashCommand && (
                  <Text
                    size='xs'
                    c='gray.6'
                    sx={{ minWidth: 0, flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {isPlainLabel
                      ? (step.toolLabel || 'Tool call')
                      : step.toolLabel
                        ? <>{'"'}{step.toolLabel}{'"'}</>
                        : null
                    }
                  </Text>
                )
              )}

              {childSummary && (
                <>
                  <Text size='xs' c='gray.6' style={{ flexShrink: 0 }}>·</Text>
                  <Text size='xs' c='gray.6' style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {childSummary}
                  </Text>
                </>
              )}

              {!isThinking && !isLibraryDocuments && step.resultCount !== undefined && step.resultCount > 0 && (
                <>
                  <Text size='xs' c='gray.6' style={{ flexShrink: 0 }}>·</Text>
                  <Text size='xs' c='gray.6' style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
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
            </>
          )}

          <Box sx={{ flex: 1 }} />

          {step.model && (
            <Badge size='xs' variant='filled' bg='dark.5' c='gray.6' fw={400} tt='none'>
              {step.model}
            </Badge>
          )}

          {(step.inputTokens !== undefined || step.outputTokens !== undefined) && (
            <Text size='xs' c='gray.6' style={{ fontVariantNumeric: 'tabular-nums' }}>
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
