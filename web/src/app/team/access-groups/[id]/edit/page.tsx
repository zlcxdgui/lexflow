import { AccessGroupForm } from '../../AccessGroupForm';

export default async function EditAccessGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AccessGroupForm mode="edit" groupId={id} />;
}
