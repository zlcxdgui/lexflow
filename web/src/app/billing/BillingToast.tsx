'use client';

import { useEffect, useState } from 'react';
import styles from './billing.module.css';

type BillingToastEventDetail = {
  message: string;
  tone?: 'success' | 'error';
};

type ToastItem = BillingToastEventDetail & { id: number };

export function emitBillingToast(detail: BillingToastEventDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('billing-toast', { detail }));
}

export function BillingToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    let seq = 1;
    const timers = new Map<number, ReturnType<typeof setTimeout>>();

    const onToast = (event: Event) => {
      const custom = event as CustomEvent<BillingToastEventDetail>;
      const message = String(custom.detail?.message || '').trim();
      if (!message) return;
      const item: ToastItem = {
        id: seq++,
        message,
        tone: custom.detail?.tone || 'success',
      };
      setItems((prev) => [...prev, item]);
      const timer = setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== item.id));
        timers.delete(item.id);
      }, 3200);
      timers.set(item.id, timer);
    };

    window.addEventListener('billing-toast', onToast as EventListener);
    return () => {
      window.removeEventListener('billing-toast', onToast as EventListener);
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className={styles.toastViewport} aria-live="polite" aria-atomic="true">
      {items.map((item) => (
        <div
          key={item.id}
          className={`${styles.toast} ${item.tone === 'error' ? styles.toastError : styles.toastSuccess}`}
          role="status"
        >
          <div className={styles.toastTitle}>
            {item.tone === 'error' ? 'Não foi possível concluir' : 'Concluído'}
          </div>
          <div className={styles.toastMessage}>{item.message}</div>
        </div>
      ))}
    </div>
  );
}
