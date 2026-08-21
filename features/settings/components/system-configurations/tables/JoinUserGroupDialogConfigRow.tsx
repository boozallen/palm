import EditJoinUserGroupDialogForm from '@/features/settings/components/system-configurations/forms/EditJoinUserGroupDialogForm';

interface JoinUserGroupDialogConfigRowProps {
  joinUserGroupDialogExternalLink: string;
}

const JoinUserGroupDialogConfigRow = ({ joinUserGroupDialogExternalLink }: JoinUserGroupDialogConfigRowProps) => {

  return (
    <tr data-testid='join-user-group-dialog-config-row'>
      <td colSpan={2}>
        <EditJoinUserGroupDialogForm joinUserGroupDialogExternalLink={joinUserGroupDialogExternalLink} />
      </td>
    </tr>
  );
};
export default JoinUserGroupDialogConfigRow;
