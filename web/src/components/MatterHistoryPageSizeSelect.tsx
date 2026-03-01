'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import styles from '@/app/matters/[id]/matter.module.css';
import { UISelect } from '@/components/ui/Select';

type Props = {
  currentPageSize: number;
};

export function MatterHistoryPageSizeSelect({ currentPageSize }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  return (
    <label className={styles.paginationLabel}>
      Itens:
      <UISelect
        className={styles.paginationSelect}
        value={String(currentPageSize)}
        ariaLabel="Itens por página do histórico"
        onChange={(nextValue) => {
          const params = new URLSearchParams(search.toString());
          params.set('tab', 'history');
          params.set('historyPage', '1');
          params.set('historyPageSize', nextValue);
          router.replace(`${pathname}?${params.toString()}`);
        }}
        options={[
          { value: '10', label: '10' },
          { value: '20', label: '20' },
          { value: '50', label: '50' },
        ]}
      />
    </label>
  );
}
