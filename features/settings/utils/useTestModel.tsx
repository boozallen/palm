import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import useTestModelStatus from '@/features/settings/api/test-model-status';

const useTestModel = () => {
  const { mutateAsync: testModelStatus, error: testModelStatusError } =
    useTestModelStatus();

  const testModel = async (
    modelId: string,
    setIsTestingModel: (arg0: boolean) => void
  ) => {
    setIsTestingModel(true);

    try {
      const result = await testModelStatus({ modelId });
   
      if (result.isValid) {
        notifications.show({
          title: 'Model Test Successful',
          message: 'Provider and model configuration is valid.',
          icon: <IconCheck />,
          color: 'green',
          autoClose: true,
        });
      } else {
        notifications.show({
          title: 'Model Test Failed',
          message:
            result.errorMessage ??
            'An configuration error occurred while testing the model. Please check your model name and api key.',
          icon: <IconX />,
          color: 'red',
          autoClose: true,
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Model Test Error',
        message:
          testModelStatusError?.message ??
          'An error occurred while testing the model. Please try again.',
        icon: <IconX />,
        color: 'red',
        autoClose: true,
      });
    } finally {
      setIsTestingModel(false);
    }
  };

  return testModel;
};

export default useTestModel;
