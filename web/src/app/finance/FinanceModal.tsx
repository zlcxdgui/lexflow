'use client';

import type { ReactNode } from 'react';
import styles from './finance.module.css';

type FinanceModalProps = {
  open: boolean;
  ariaLabel: string;
  title: ReactNode;
  description?: ReactNode;
  size?: 'md' | 'lg';
  children: ReactNode;
};

export function FinanceModal({
  open,
  ariaLabel,
  title,
  description,
  size = 'md',
  children,
}: FinanceModalProps) {
  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className={`${styles.modalCard} ${size === 'lg' ? styles.modalCardLg : ''}`.trim()}>
        <h3 className={styles.modalTitle}>{title}</h3>
        {description ? <div className={styles.modalText}>{description}</div> : null}
        {children}
      </div>
    </div>
  );
}
