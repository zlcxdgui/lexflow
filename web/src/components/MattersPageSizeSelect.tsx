'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import styles from '@/app/matters/matters.module.css';
import { UISelect } from '@/components/ui/Select';

type Props = {
  currentPageSize: number;
};

export function MattersPageSizeSelect({ currentPageSize }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className={styles.paginationLabel}>
      Itens:
      <UISelect
        className={styles.paginationSelect}
        value={String(currentPageSize)}
        ariaLabel="Itens por página"
        onChange={(nextValue) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set('pageSize', nextValue);
          params.set('page', '1');
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
