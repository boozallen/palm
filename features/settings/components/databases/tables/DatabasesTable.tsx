import { Box, Table, Anchor } from '@mantine/core';
import { JSX } from 'react';
import Link from 'next/link';

import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

export default function DatabasesTable(): JSX.Element {
  const track = useTrackClientEvent();

  return (
    <Box bg='dark.6' p='md'>
      <Table data-testid='databases-table'>
        <thead>
          <tr>
            <th>Database</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <Anchor
                href='/settings/databases/postgres'
                component={Link}
                onClick={() => track.navigate('PostgreSQL', '/settings/databases/postgres')}
              >
                PostgreSQL
              </Anchor>
            </td>
            <td>Relational</td>
            <td>Primary relational database storing user data, conversations, and system configurations. Query interface available for analysis and reporting.</td>
          </tr>
          <tr>
            <td>
              <Anchor
                href='/settings/databases/neo4j'
                component={Link}
                onClick={() => track.navigate('Neo4j', '/settings/databases/neo4j')}
              >
                Neo4j
              </Anchor>
            </td>
            <td>Graph</td>
            <td>Graph database storing knowledge base entity relationships, semantic connections, and hierarchical data structures for network visualization.</td>
          </tr>
        </tbody>
      </Table>
    </Box>
  );
}
