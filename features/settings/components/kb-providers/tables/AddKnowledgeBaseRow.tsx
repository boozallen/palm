import { Dispatch, SetStateAction } from 'react';
import { DisplayKnowledgeBaseRow } from './KbProvidersTable';
import AddKnowledgeBaseForm from '@/features/settings/components/kb-providers/forms/AddKnowledgeBaseForm';  

type AddKnowledgeBaseRowProps = Readonly<{
  kbProviderId: string;
  setShowAddKnowledgeBaseRow: Dispatch<SetStateAction<DisplayKnowledgeBaseRow>>;
}>;

export default function AddKnowledgeBaseRow({ kbProviderId, setShowAddKnowledgeBaseRow  }: AddKnowledgeBaseRowProps) {

  return (
    <tr data-testid='add-knowledge-base-row' className='provider-model-row'>
      <td colSpan={4}>
        <AddKnowledgeBaseForm kbProviderId={kbProviderId} setShowAddKnowledgeBaseRow={setShowAddKnowledgeBaseRow}/>
      </td>
    </tr>
  );
}
