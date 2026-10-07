import { useEffect, useMemo, useState } from 'react';
import { Pagination, Stack, Table, Text, Tooltip, Group, TextInput, Select } from '@mantine/core';
import { IconInfoCircle, IconSearch } from '@tabler/icons-react';

import { ITEMS_PER_PAGE } from '@/features/shared/utils';
import { DocumentLineage, ShareStatusCounts, DocumentUploadStatus } from '@/features/shared/types/document';
import AdminDataSourceRow from './AdminDataSourceRow';

export type AdminDocumentRow = {
  id: string;
  userId: string;
  filename: string;
  adminCreated: boolean;
  assignedGroupIds: string[];
  createdAt: string | Date;
  userName: string;
  userEmail?: string;
  userGroupMemberships: Array<{ id: string; label: string }>;
  uploadStatus: DocumentUploadStatus;
  lineage?: DocumentLineage;
  graphJobInfo?: {
    status: 'Pending' | 'Building' | 'Resolving' | 'Completed' | 'Failed';
    jobId?: string;
    progress?: {
      totalChunks?: number;
      processedChunks?: number;
      currentStep?: string;
    };
    completedAt?: string | Date;
    errorMessage?: string;
  };
  shareStatusCounts?: ShareStatusCounts;
};

export type GroupOption = {
  id: string;
  label: string;
};

type AdminDataSourcesTableProps = {
  documents: AdminDocumentRow[];
  availableGroups: GroupOption[];
  currentUserId: string;
  onPromoteDocument: (documentId: string) => void;
};

export default function AdminDataSourcesTable({
  documents,
  availableGroups,
  currentUserId,
  onPromoteDocument,
}: Readonly<AdminDataSourcesTableProps>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadStatusFilter, setUploadStatusFilter] = useState<string | null>(null);
  const [graphStatusFilter, setGraphStatusFilter] = useState<string | null>(null);

  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((doc) => {
        return (
          doc.filename.toLowerCase().includes(query) ||
          doc.userName.toLowerCase().includes(query) ||
          doc.userEmail?.toLowerCase().includes(query)
        );
      });
    }

    if (uploadStatusFilter) {
      filtered = filtered.filter((doc) => {
        return doc.uploadStatus === uploadStatusFilter;
      });
    }

    if (graphStatusFilter) {
      filtered = filtered.filter((doc) => {
        return doc.graphJobInfo?.status === graphStatusFilter;
      });
    }

    return filtered;
  }, [documents, searchQuery, uploadStatusFilter, graphStatusFilter]);

  const totalPages = useMemo(() => {
    if (!filteredDocuments.length) {
      return 1;
    }
    return Math.ceil(filteredDocuments.length / ITEMS_PER_PAGE);
  }, [filteredDocuments]);

  const paginatedDocuments = useMemo(
    () => filteredDocuments.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredDocuments, currentPage]
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, uploadStatusFilter, graphStatusFilter]);

  return (
    <Stack bg='dark.6' p='md' spacing='sm'>
      <Group>
        <TextInput
          style={{ flex: 2 }}
          label='Search'
          placeholder='Search by filename, username, or email...'
          icon={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          data-testid='admin-data-sources-search'
        />
        <Select
          style={{ flex: 1 }}
          label='Upload Status'
          placeholder='Filter by upload status'
          value={uploadStatusFilter}
          onChange={setUploadStatusFilter}
          data={[
            { value: 'Pending', label: 'Pending' },
            { value: 'Completed', label: 'Completed' },
            { value: 'Failed', label: 'Failed' },
          ]}
          clearable
          data-testid='admin-data-sources-upload-status-filter'
        />
        <Select
          style={{ flex: 1 }}
          label='Graph Status'
          placeholder='Filter by graph status'
          value={graphStatusFilter}
          onChange={setGraphStatusFilter}
          data={[
            { value: 'Pending', label: 'Pending' },
            { value: 'Building', label: 'Building' },
            { value: 'Resolving', label: 'Resolving' },
            { value: 'Completed', label: 'Completed' },
            { value: 'Failed', label: 'Failed' },
          ]}
          clearable
          data-testid='admin-data-sources-graph-status-filter'
        />
      </Group>
      <Table data-testid='admin-data-sources-table'>
        <thead>
          <tr>
            <th><Text fz='sm' fw={500} data-testid='header-filename'>Filename</Text></th>
            <th><Text fz='sm' fw={500} data-testid='header-owner'>Owner</Text></th>
            <th>
              <Group spacing='xs'>
                <Text fz='sm' fw={500} data-testid='header-auto-shared-with'>Share Status (Admin Data Source)</Text>
                <Tooltip
                  label={
                    <Text fz='xs' mb='xs'>
                      Documents uploaded by Admin users can be made immediately accessible to members of selected user groups.
                    </Text>
                  }
                  multiline
                  width={280}
                  position='top'
                  withinPortal
                >
                  <IconInfoCircle size={14} style={{ cursor: 'help' }} />
                </Tooltip>
              </Group>
            </th>
            <th>
              <Group spacing='xs'>
                <Text fz='sm' fw={500} data-testid='header-sharing'>Share Status (User Groups)</Text>
                <Tooltip
                  label={
                    <>
                      <Text fz='xs' mb='xs'>
                        Original documents show &apos;Original&apos;, while shared copies show their generation (e.g., &apos;2nd gen&apos;).
                      </Text>
                      <Text fz='xs' mb='xs'>  
                        Hover over the generation badge to see the complete sharing lineage between users.
                      </Text>
                      <Text fz='xs' mb='xs'>  
                        Also displays counts for pending, accepted, and rejected shares.
                      </Text>
                    </>
                  }
                  multiline
                  width={300}
                  position='top'
                  withinPortal
                >
                  <IconInfoCircle size={14} style={{ cursor: 'help' }} />
                </Tooltip>
              </Group>
            </th>
            <th>
              <Group spacing='xs'>
                <Text fz='sm' fw={500} data-testid='header-upload-status'>Upload Status</Text>
                <Tooltip
                  label='Shows the upload processing status of the document. Documents can be Pending (processing), Completed (ready to use), or Failed (upload error).'
                  multiline
                  width={280}
                  position='top'
                  withinPortal
                >
                  <IconInfoCircle size={14} style={{ cursor: 'help' }} />
                </Tooltip>
              </Group>
            </th>
            <th>
              <Group spacing='xs'>
                <Text fz='sm' fw={500} data-testid='header-graph-status'>Graph Status</Text>
                <Tooltip
                  label='Shows the status of the document in the knowledge graph. Documents can be Pending (queued), Building (extracting entities), Resolving (linking entities), Completed (ready), or Failed (error occurred).'
                  multiline
                  width={280}
                  position='top'
                  withinPortal
                >
                  <IconInfoCircle size={14} style={{ cursor: 'help' }} />
                </Tooltip>
              </Group>
            </th>
            <th><Text fz='sm' fw={500} data-testid='header-created'>Created</Text></th>
            <th><Text fz='sm' fw={500} data-testid='header-actions'>Actions</Text></th>
          </tr>
        </thead>
        <tbody>
          {paginatedDocuments.map(doc => (
            <AdminDataSourceRow
              key={doc.id}
              document={doc}
              availableGroups={availableGroups}
              currentUserId={currentUserId}
              onPromoteDocument={onPromoteDocument}
            />
          ))}
        </tbody>
      </Table>
      {totalPages > 1 && (
        <Pagination
          total={totalPages}
          value={currentPage}
          onChange={setCurrentPage}
          position='right'
          data-testid='admin-data-sources-pagination'
          getControlProps={(control) => {
            switch (control) {
              case 'previous':
                return { 'aria-label': 'Previous' };
              case 'next':
                return { 'aria-label': 'Next' };
              default:
                return {};
            }
          }}
        />
      )}
    </Stack>
  );
}
