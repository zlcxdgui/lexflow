'use client';

import type { ReactNode } from 'react';
import styles from './finance.module.css';

type FinanceModalActionsProps = {
  children: ReactNode;
};

export function FinanceModalActions({ children }: FinanceModalActionsProps) {
  return <div className={styles.rowActions}>{children}</div>;
}
