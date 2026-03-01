import type { ReactNode } from 'react';
import styles from './ui.module.css';

type CardProps = {
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'muted' | 'inset';
  padding?: 'sm' | 'md' | 'lg' | 'none';
  as?: 'div' | 'section';
};

export function Card({ children, className, tone = 'default', padding = 'md', as = 'div' }: CardProps) {
  const Tag = as;
  const toneClass = tone === 'muted' ? styles.cardMuted : tone === 'inset' ? styles.cardInset : '';
  const padClass =
    padding === 'sm'
      ? styles.cardPaddedSm
      : padding === 'lg'
      ? styles.cardPaddedLg
      : padding === 'none'
      ? ''
      : styles.cardPaddedMd;
  return <Tag className={[styles.card, toneClass, padClass, className].filter(Boolean).join(' ')}>{children}</Tag>;
}

