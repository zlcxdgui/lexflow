import type { PropsWithChildren, ReactNode } from 'react';
import styles from './ui.module.css';

export function UIListStack({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={[styles.listStack, className].filter(Boolean).join(' ')}>{children}</div>;
}

export function UIListEmpty({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={[styles.listEmpty, className].filter(Boolean).join(' ')}>{children}</div>;
}

export function UIListRow({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <div className={[styles.listRow, className].filter(Boolean).join(' ')}>{children}</div>;
}

export function UIListRowMain({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={[styles.listRowMain, className].filter(Boolean).join(' ')}>{children}</div>;
}

export function UIListRowActions({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <div className={[styles.listRowActions, className].filter(Boolean).join(' ')}>{children}</div>;
}

export function UIListPager({
  meta,
  actions,
  className,
}: {
  meta: ReactNode;
  actions: ReactNode;
  className?: string;
}) {
  return (
    <div className={[styles.listPager, className].filter(Boolean).join(' ')}>
      <div className={styles.listPagerMeta}>{meta}</div>
      <div className={styles.listPagerActions}>{actions}</div>
    </div>
  );
}

export function UIListPagerPage({ children }: PropsWithChildren) {
  return <span className={styles.listPagerPage}>{children}</span>;
}

