import { useEffect } from 'react';
import { Box, Select } from '@mantine/core';

import { useGetAiProviderModelSelectData } from '@/features/shared/data';

type ModelSelectProps = Readonly<{
  value: string;
  setValue: (value: string) => void;
  onChange: (value: string) => void;
  onBlur?: any;
  onFocus?: any;
  error?: any;
  checked?: any;
}>

export default function ModelSelect({
  value,
  setValue,
  onChange,
  onBlur,
  onFocus,
  error,
  checked,
}: ModelSelectProps) {
  const { modelOptions, modelsIsError, modelsError } = useGetAiProviderModelSelectData();

  useEffect(() => {
    if (modelOptions.length > 0) {
      const validModel = modelOptions.find(model => model.value === value);

      if (!validModel) {
        setValue(modelOptions[0].value);
      }
    }
  }, [modelOptions, value, setValue]);

  if (modelsIsError) {
    return <Box>{modelsError.message}</Box>;
  }

  return (
    <Select
      label='Language model'
      placeholder='Select a model'
      nothingFound='No large language models available'
      data={modelOptions}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      onFocus={onFocus}
      error={error}
      checked={checked}
    />
  );
}
