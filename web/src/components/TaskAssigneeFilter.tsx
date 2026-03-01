'use client';

import { useRouter } from 'next/navigation';
import { UISelect } from '@/components/ui/Select';

type UserOption = {
  id: string;
  name: string;
  email: string;
};

export function TaskAssigneeFilter({
  matterId,
  taskFilter,
  assignee,
  users,
  wrapClassName,
  labelClassName,
  selectClassName,
}: {
  matterId: string;
  taskFilter: string;
  assignee: string;
  users: UserOption[];
  wrapClassName: string;
  labelClassName: string;
  selectClassName: string;
}) {
  const router = useRouter();

  return (
    <div className={wrapClassName}>
      <label className={labelClassName}>Responsável</label>
      <UISelect
        className={selectClassName}
        value={assignee}
        ariaLabel="Responsável"
        onChange={(value) => {
          const params = new URLSearchParams();
          params.set('tab', 'tasks');
          params.set('taskFilter', taskFilter);
          if (value) params.set('assignee', value);
          router.replace(`/matters/${matterId}?${params.toString()}`);
        }}
        options={[
          { value: '', label: 'Todos' },
          { value: 'unassigned', label: 'Sem responsável' },
          ...users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
        ]}
      />
    </div>
  );
}
