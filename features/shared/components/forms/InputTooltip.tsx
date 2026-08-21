import { Tooltip } from '@mantine/core';
import { ReactNode } from 'react';

interface InputTooltipProps {
  disabled: boolean,
  message: string
  children: ReactNode
}
export function InputTooltip({ disabled, message, children }: Readonly<InputTooltipProps>) {

  return (
    <Tooltip.Floating
      label={message}
      disabled={disabled}>
      <span style={{ display: 'contents' }}>
        {children}
      </span>
    </Tooltip.Floating>
  );
}
