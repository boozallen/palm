import { Button } from '@mantine/core';

type ContinueButtonProps = {
  onClick: ((event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void);
  disabled: boolean;
}

export default function ContinueButton({ onClick, disabled }: ContinueButtonProps) {

  return (
    <Button onClick={onClick} disabled={disabled}>
      Continue
    </Button>
  );
}
