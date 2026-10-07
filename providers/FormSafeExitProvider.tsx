import { useSafeExitModal  } from '@/features/shared/utils';

type FormSafeExitProviderProps = {
  children: React.ReactNode;
};

const FormSafeExitProvider = ({ children }: FormSafeExitProviderProps) => {

  const { setSafeExitFormToDirty, SafeExitProvider, SafeExitModal, openModal } = useSafeExitModal();

  return (
    <>
      <SafeExitProvider value={{ setSafeExitFormToDirty, openModal }}>
        {children}
      </SafeExitProvider>
      <SafeExitModal />
    </>
  );
};

export default FormSafeExitProvider;
