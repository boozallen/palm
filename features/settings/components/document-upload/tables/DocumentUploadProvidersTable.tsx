import { Box, Table, Text } from '@mantine/core';

import DocumentUploadProviderRow from './DocumentUploadProviderRow';
import Loading from '@/features/shared/components/Loading';
import useGetDocumentUploadProviders from '@/features/settings/api/document-upload/get-document-upload-providers';

export default function DocumentUploadProvidersTable() {
  const {
    data: documentUploadProviders,
    isPending: documentUploadProvidersIsPending,
    error: documentUploadProvidersError,
  } = useGetDocumentUploadProviders();

  if (documentUploadProvidersIsPending) {
    return (
      <Loading />
    );
  }

  if (documentUploadProvidersError) {
    return (
      <Text>{documentUploadProvidersError.message}</Text>
    );
  }

  if (!documentUploadProviders?.providers.length) {
    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No providers have been configured yet.</Text>
      </Box>
    );
  }

  return (
    <Box bg='dark.6' p='xl'>
      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Source URI</th>
            <th>Requirements</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {documentUploadProviders.providers.map((provider) => (
            <DocumentUploadProviderRow key={provider.id} provider={provider} />
          ))}
        </tbody>
      </Table>
    </Box>
  );
}
