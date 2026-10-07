import { Center, Loader } from '@mantine/core';

export default function CenteredLoader() {
  return (
      <Center h='100vh' data-testid='centered-loader'>
        <Loader />
      </Center>
  );
}
