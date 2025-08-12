import { Dispatch, SetStateAction } from 'react';
import { ShowModelRowType } from './AiProvidersTableBody';
import AddModelForm from '@/features/settings/components/ai-providers/forms/AddModelForm';

type AddModelRowProps = Readonly<{
  providerId: string;
  setShowAddModelRow: Dispatch<SetStateAction<ShowModelRowType>>;
  setNewModelBeingTested: Dispatch<SetStateAction<string | null>>;
}>;

export default function AddModelRow({
  providerId,
  setShowAddModelRow,
  setNewModelBeingTested,
}: AddModelRowProps) {

  return (
    <tr data-testid='add-provider-model-row'>
      <td colSpan={6}>
        <AddModelForm
          providerId={providerId}
          setShowAddModelRow={setShowAddModelRow}
          setNewModelBeingTested={setNewModelBeingTested}
        />
      </td>
    </tr>
  );
}
