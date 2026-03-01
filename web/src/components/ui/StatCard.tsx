import type { ReactNode } from 'react';
import { Card } from './Card';
import styles from './ui.module.css';

type Props = {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  className?: string;
  hrefWrapClassName?: string;
};

export function StatCard({ label, value, meta, className }: Props) {
  return (
    <Card className={[styles.statCard, className].filter(Boolean).join(' ')} padding="md">
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {meta ? <div className={styles.statMeta}>{meta}</div> : null}
    </Card>
  );
}

