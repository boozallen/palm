import { Alert, Text, List, Box } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

type CloudRequirementsBannerProps = Readonly<{
  service: string,
}>

export default function CloudRequirementsBanner({ service }: CloudRequirementsBannerProps) {

  return (
    <Alert 
      icon={<IconInfoCircle />} 
      title={`Required ${service === 's3' ? 'AWS S3' : 'AWS Bedrock'} Permissions`}
      color='blue'
      variant='light'
      mb='md'
      data-testid='cloud-requirements-banner'
    >

     {service === 's3' && (
        <Box data-testid='cloud-requirements-content-s3'>
          <Text size='sm' mb='xs'>
            To enable S3 bucket operations, your AWS IAM user or role must have the following policy configured: 
          </Text>
          <List size='sm' spacing='xs' style={{ listStyleType: 'disc' }}>
            <List.Item>
              AmazonS3ReadWriteAccess (predefined policy)
            </List.Item>
          </List>
          <Text size='sm' my='xs'>
            Or, have object-level permission policies configured:
          </Text>
          <List size='sm' spacing='xs' style={{ listStyleType: 'disc' }}>
            <List.Item>
              s3:PutObject - to upload files to your S3 bucket
            </List.Item>
            <List.Item>
              s3:GetObject - to download and read files from your S3 bucket
            </List.Item>
            <List.Item>
              s3:DeleteObject - to remove files from your S3 bucket
            </List.Item>
          </List>
        </Box>
      )}

      {service === 'bedrock' && (
        <Box data-testid='cloud-requirements-content-bedrock'>
          <Text size='sm' mb='xs'>
            To use Amazon Bedrock functionality, your AWS IAM user or role must have at least <b>1</b> of the following policy configurations:
          </Text>
          <List size='sm' spacing='xs' style={{ listStyleType: 'disc' }}>
            <List.Item>
              AmazonBedrockFullAccess (predefined policy) for complete access
            </List.Item>
            <List.Item>
              A custom policy with bedrock:InvokeModel and bedrock:ListFoundationModels permissions
            </List.Item>
          </List>
        </Box>
      )}
    </Alert>
  );
};
