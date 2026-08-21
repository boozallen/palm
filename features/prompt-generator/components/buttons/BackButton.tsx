import { Button } from '@mantine/core';

type BackButtonProps = {
  onClick: ((event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void);
}

export default function BackButton({ onClick }: BackButtonProps) {

  return (
    <Button variant='default' onClick={onClick}>
      Back
    </Button>
  );
}
