import type { ReactNode } from 'react';
import styles from './ui.module.css';

type Props = {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  headingAs?: 'h1' | 'h2' | 'h3';
};

export function SectionHeader({ title, eyebrow, description, actions, className, headingAs = 'h2' }: Props) {
  const Heading = headingAs;
  return (
    <div className={[styles.sectionHeader, className].filter(Boolean).join(' ')}>
      <div className={styles.sectionTitleWrap}>
        {eyebrow ? <div className={styles.sectionEyebrow}>{eyebrow}</div> : null}
        <Heading className={styles.sectionTitle}>{title}</Heading>
        {description ? <div className={styles.sectionDesc}>{description}</div> : null}
      </div>
      {actions}
    </div>
  );
}
