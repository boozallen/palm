import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';
import { Button, Textarea, Grid, Center } from '@mantine/core';
import { useEffect, useState } from 'react';
import { systemMessageSchema, SystemConfigFields } from '@/features/shared/types';
import { notifications } from '@mantine/notifications';
import { IconX, IconCheck } from '@tabler/icons-react';

interface SystemMessageConfigRowProps {
  systemMessage: string;
}

const SystemMessageConfigRow = ({ systemMessage }: SystemMessageConfigRowProps) => {

  const [isButtonDisabled, setIsButtonDisabled] = useState(true);
  const [newSystemMessage, setNewSystemMessage] = useState(systemMessage);
  const [error, setError] = useState<string | undefined>(undefined);

  const updateSystemConfig = useUpdateSystemConfig();

  useEffect(() => {
    setNewSystemMessage(systemMessage);
    setIsButtonDisabled(true);
  }, [systemMessage]);

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewSystemMessage(e.target.value);
    setIsButtonDisabled(e.target.value.trim() === systemMessage.trim());

    if (error) {
      setError(undefined);
    }
  };

  const handleClick = () => {
    const trimmedMessage = newSystemMessage.trim();

    const result = systemMessageSchema.safeParse({ systemMessage: trimmedMessage });

    if (!result.success) {
      setError(result.error.issues[0].message);
    } else {
      updateSystemConfig.mutate(
        {
          configField: SystemConfigFields.SystemMessage,
          configValue: trimmedMessage,
        },
        {
          onError: (error) => {
            notifications.show({
              id: 'update-config-failed',
              title: 'Failed to update',
              message:
                error.message ||
                'Could not update system message configuration.',
              icon: <IconX />,
              variant: 'failed_operation',
              autoClose: false,
            });
          },
        }
      );

      setIsButtonDisabled(true);
      setError(undefined);

      notifications.show({
        title: 'System Message Updated',
        message: 'The system persona message has been updated successfully.',
        variant: 'successful_operation',
        icon: <IconCheck />,
        autoClose: true,
      });
    }
  };

  return (
    <tr data-testid='system-message-config-row'>
      <td colSpan={2}>
        <Grid>
          <Grid.Col span={10}>
            <Textarea
              aria-label='Edit system persona message here'
              data-testid='system-message-textarea'
              mb={'0'}
              pr={0}
              p={'xs'}
              pl={0}
              radius={'xs'}
              autosize
              minRows={1}
              maxRows={15}
              onChange={handleMessageChange}
              value={newSystemMessage}
              error={error}
              variant='default'
              styles={(theme) => ({
                input: {
                  padding: `${theme.spacing.sm}!important`,
                },
              })}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <Center>
              <Button
                mt='xs'
                disabled={isButtonDisabled}
                onClick={() => {
                  handleClick();
                }}
              >
                Update
              </Button>
            </Center>
          </Grid.Col>
        </Grid>
      </td>
    </tr>
  );
};
export default SystemMessageConfigRow;
