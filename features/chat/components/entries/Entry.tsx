import { Box, Grid, List, Stack, TypographyStylesProvider } from '@mantine/core';
import { ReactNode } from 'react';
import Citations from '@/features/chat/components/entries/elements/Citations';
import ArtifactButton from '@/features/chat/components/entries/elements/ArtifactButton';
import { MessageRole, Artifact } from '@/features/chat/types/message';
import { useChat } from '@/features/chat/providers/ChatProvider';

type EntryProps = Readonly<{
  id: string;
  avatar?: ReactNode;
  role: MessageRole;
  children: ReactNode;
  citations?: Array<{
    knowledgeBaseLabel: string;
    citation: string;
  }>;
  artifacts?: Artifact[];
  actions?: ReactNode;
}>;

export default function Entry(props: EntryProps) {
  const { selectedArtifact } = useChat();

  const role = props.role;

  const citations = props.citations ? props.citations : [];
  const hasCitations = citations.length > 0;

  const artifacts = props.artifacts ? props.artifacts : [];
  const hasArtifacts = artifacts.length > 0;

  return (
    <List.Item
      bg={role === MessageRole.User ? 'dark.6' : 'dark.7'}
      p='xl'
      pb='md'
      data-testid={props.id}
    >
      <Stack mx={selectedArtifact ? 'xs' : 'xxxl'}>
        <Grid>
          {props.avatar && (
            <Grid.Col span='content'>
              {hasCitations &&
                <Box h='xl' />
              } {/* Empty cell in top left to accommodate Citations component */}
              {props.avatar}
            </Grid.Col>
          )}

          <Grid.Col span={props.avatar ? 11 : 12}>
            {hasCitations &&
              <Citations citations={citations} />
            }
            <TypographyStylesProvider>
              {props.children}
            </TypographyStylesProvider>
            {hasArtifacts &&
              artifacts.map((artifact) => (
                <div key={`artifact-button-${artifact.id}`}>
                  <ArtifactButton artifact={artifact} />
                </div>
              ))
            }
            {props.actions}
          </Grid.Col>
        </Grid>
      </Stack>
    </List.Item>
  );
}
