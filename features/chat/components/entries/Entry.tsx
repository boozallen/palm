import {
  Badge,
  Box,
  Grid,
  List,
  Stack,
  Text,
  TypographyStylesProvider,
  Group,
} from '@mantine/core';
import { ReactNode } from 'react';

import Citations from '@/features/chat/components/entries/elements/Citations';
import ViewGraphAction from '@/features/chat/components/entries/actions/action-item/ViewGraphAction';
import ArtifactButton from '@/features/chat/components/entries/elements/ArtifactButton';
import { MessageRole, Artifact, Citation } from '@/features/chat/types/message';

function getDisplayMessages(messages: string[] | undefined): string[] {
  if (!messages || messages.length === 0) {
    return [];
  }
  const filtered = messages.filter((msg) => msg !== 'Preparing chat completion...');
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const msg of filtered) {
    if (!seen.has(msg)) {
      seen.add(msg);
      unique.push(msg);
    }
  }
  return unique;
}

type EntryProps = Readonly<{
  id: string;
  avatar?: ReactNode;
  role: MessageRole;
  children: ReactNode;
  deepResearch?: Boolean;
  citations?: Citation[];
  hasEvidenceGraph?: boolean;
  jobMessages?: string[];
  useGraph: boolean;
  artifacts?: Artifact[];
  actions?: ReactNode;
}>;

export default function Entry(props: EntryProps) {
  const role = props.role;

  const deepResearch = props.deepResearch ? props.deepResearch : false;

  const citations = props.citations ? props.citations : [];
  const hasCitations = citations.length > 0;

  const artifacts = props.artifacts ? props.artifacts : [];
  const hasArtifacts = artifacts.length > 0;

  const displayMessages = getDisplayMessages(props.jobMessages);

  return (
    <List.Item
      bg='dark.7'
      px='md'
      mb='xs'
      data-testid={props.id}
      data-message-id={props.id}
    >
      <Stack
        bg={role === MessageRole.User ? 'dark.5' : 'dark.7'}
        p='sm'
        style={{
          borderRadius: role === MessageRole.User ? '8px' : '0',
        }}
        sx={(theme) => (role === MessageRole.User ? { border: `1px solid ${theme.colors.dark[4]}` } : {})}
      >
        <Grid>
          {props.avatar && (
            <Grid.Col span='content'>
              {hasCitations && <Box h='xl' />}{' '}
              {/* Empty cell in top left to accommodate Citations component */}
              {props.avatar}
            </Grid.Col>
          )}

          <Grid.Col span={props.avatar ? 11 : 12}>
            <Group spacing='sm' mb='md'>
              {deepResearch && <Badge size='sm' variant='outline'>Research</Badge>}
              {hasCitations && <Citations citations={citations} messageId={props.id} />}
              {props.hasEvidenceGraph && <ViewGraphAction messageId={props.id} />}
            </Group>

            {displayMessages.length > 0 && (
              <div style={{
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                direction: 'rtl',
                textAlign: 'left',
                marginBottom: 8,
              }}>
                <Text
                  size='xs'
                  color='dimmed'
                  italic
                  component='span'
                  style={{ direction: 'ltr', unicodeBidi: 'bidi-override' }}
                >
                  {displayMessages.join(' → ')}
                </Text>
              </div>
            )}
            <TypographyStylesProvider>
              {props.children}
            </TypographyStylesProvider>
            {hasArtifacts &&
              artifacts.map((artifact) => (
                <div key={`artifact-button-${artifact.id}`}>
                  <ArtifactButton artifact={artifact} />
                </div>
              ))}
            {props.actions}
          </Grid.Col>
        </Grid>
      </Stack>
    </List.Item>
  );
}
