import { Badge as MBadge, Loader } from '@mantine/core';
import { ComplianceStatus } from '@/features/ai-agents/types/certa/webPolicyCompliance';

type BadgeProps = Readonly<{
  isLoading: boolean;
  result?: ComplianceStatus;
}>;

export default function Badge({
  result,
  isLoading,
}: BadgeProps) {
  if (isLoading) {
    return (
      <Loader
        size='sm'
        data-testid='loading-spinner'
      />
    );
  }

  if (!result) {
    return <></>;
  }

  switch (result) {
    case ComplianceStatus.Yes:
      return (
        <MBadge size='lg' color='green.6' c='black' variant='filled'>
          Compliant
        </MBadge>
      );
    case ComplianceStatus.LeanYes:
      return (
        <MBadge size='lg' color='green.2' c='black' variant='filled'>
          Lean Compliant
        </MBadge>
      );
    case ComplianceStatus.LeanNo:
      return (
        <MBadge size='lg' color='orange.6' c='black' variant='filled'>
          Lean Not Compliant
        </MBadge>
      );
    case ComplianceStatus.No:
      return (
        <MBadge size='lg' color='red.6' c='black' variant='filled'>
          Not Compliant
        </MBadge>
      );
    case ComplianceStatus.VeryUnclear:
    default:
      return (
        <MBadge size='lg' color='gray.6' c='black' variant='filled'>
          Very unsure
        </MBadge>
      );
  }
}
