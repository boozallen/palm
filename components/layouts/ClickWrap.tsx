import { Button, Checkbox, Group, Modal, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useCookies } from 'react-cookie';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import Loading from '@/features/shared/components/Loading';
import AppHead from '@/components/layouts/AppHead';

type ClickwrapProps = {
  children: React.ReactNode;
};

export default function Clickwrap({ children }: ClickwrapProps) {
  const { data: systemConfig, isPending: systemConfigIsPending } = useGetSystemConfig();
  const [cookies, setCookie] = useCookies();
  const cookieMaxAge = 365 * 24 * 60 * 60; // One year in seconds
  const cookiePolicyAcknowledged = 'policy-acknowledged';

  const handleSubmit = () => {
    setCookie(cookiePolicyAcknowledged, systemConfig?.termsOfUseBody, { maxAge: cookieMaxAge });
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
    return <Loading />;
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
              <Button type='submit' disabled={!form.isValid()}>Continue</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
