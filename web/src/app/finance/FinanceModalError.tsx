'use client';

import styles from './finance.module.css';

type FinanceModalErrorProps = {
  message?: string | null;
};

export function FinanceModalError({ message }: FinanceModalErrorProps) {
  if (!message) return null;
  return <div className={styles.error}>{message}</div>;
}
