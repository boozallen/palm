type KbProvider = {
  id: string;
  label: string;
};

type UserKbProviderRowProps = Readonly<{
  kbProvider: KbProvider;
}>;

export default function UserKbProviderRow({ kbProvider }: UserKbProviderRowProps) {

  return (
    <tr>
      <td>{kbProvider.label}</td>
      <td></td>
      <td></td>
    </tr>
  );
}
