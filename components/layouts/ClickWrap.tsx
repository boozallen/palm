import { Button, Checkbox, Group, Modal, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useCookies } from 'react-cookie';
import { notifications } from '@mantine/notifications';

import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useAcknowledgeSecurityPolicy } from '@/features/shared/api/acknowledge-security-policy';
import AppHead from '@/components/layouts/AppHead';
import LoadingOverlay from '@/features/shared/components/LoadingOverlay';

type ClickwrapProps = {
  children: React.ReactNode;
};

export default function Clickwrap({ children }: ClickwrapProps) {
  const { data: systemConfig, isPending: systemConfigIsPending } = useGetSystemConfig();
  const acknowledgeSecurityPolicy = useAcknowledgeSecurityPolicy();
  const [cookies, setCookie] = useCookies();
  const cookieMaxAge = 365 * 24 * 60 * 60; // One year in seconds
  const cookiePolicyAcknowledged = 'policy-acknowledged';

  const handleSubmit = async () => {
    if (!systemConfig?.termsOfUseBody) {
      return;
    }

    try {
      await acknowledgeSecurityPolicy.mutateAsync({
        policyContent: systemConfig.termsOfUseBody,
      });

      setCookie(cookiePolicyAcknowledged, systemConfig.termsOfUseBody, { maxAge: cookieMaxAge });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to acknowledge security policy. Please try again.',
        color: 'red',
      });
    }
  };

  const form = useForm({
    initialValues: {
      accept: '',
    },
    validate: {
      accept: (value) => (value ? null : 'You must agree to the terms before proceeding'),
    },
  });

  if (systemConfig?.termsOfUseBody === cookies[cookiePolicyAcknowledged]) {
    return <>{children}</>;
  }

  if (systemConfigIsPending) {
    return <LoadingOverlay />;
  }

  return (
    <>
      <AppHead />
      <Modal
        centered={true}
        opened={true}
        onClose={() => { }}
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        overlayProps={{
          opacity: 1.0,
        }}
        transitionProps={{ transition: 'fade', duration: 200 }}
        padding='lg'
        size='md'
        title={systemConfig?.termsOfUseHeader}
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack spacing='md'>
            <Text color='gray.8' align='left' size='sm'>
              {systemConfig?.termsOfUseBody}
            </Text>
            <Checkbox
              label={systemConfig?.termsOfUseCheckboxLabel} {...form.getInputProps('accept', { type: 'checkbox' })} />
            <Group grow>
              <Button
                type='submit'
                disabled={!form.isValid()}
                loading={acknowledgeSecurityPolicy.isPending}
              >
                Continue
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
