import { Tooltip } from '@mantine/core';
import { ReactNode } from 'react';

interface ModelUnavailableTooltipProps {
  disabled: boolean,
  message: string
  children: ReactNode
}
export function ModelUnavailableToolTip({ disabled, message, children }: Readonly<ModelUnavailableTooltipProps>) {

  return (
    <Tooltip.Floating
      label={message}
      disabled={disabled}>
      <span>
        {children}
      </span>
    </Tooltip.Floating>
  );
}
