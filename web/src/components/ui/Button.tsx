import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './ui.module.css';

type CommonProps = {
  children: ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'md' | 'sm';
};

type ButtonAsButton = CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: never };
type ButtonAsLink = CommonProps & { href: string };

export function UIButton(props: ButtonAsButton | ButtonAsLink) {
  const variant = props.variant ?? 'secondary';
  const variantClass =
    variant === 'primary'
      ? styles.buttonPrimary
      : variant === 'danger'
      ? styles.buttonDanger
      : variant === 'ghost'
      ? styles.buttonGhost
      : styles.buttonSecondary;

  const sizeClass = (props.size ?? 'md') === 'sm' ? styles.buttonSm : '';
  const finalCls = [styles.button, variantClass, sizeClass, props.className].filter(Boolean).join(' ');

  if ('href' in props && props.href) {
    const { href, children } = props;
    return (
      <Link href={href} className={finalCls}>
        {children}
      </Link>
    );
  }

  const { children } = props as ButtonAsButton;
  const buttonProps = { ...(props as ButtonAsButton) };
  delete (buttonProps as { variant?: string }).variant;
  delete (buttonProps as { className?: string }).className;
  delete (buttonProps as { children?: ReactNode }).children;
  return (
    <button {...buttonProps} className={finalCls}>
      {children}
    </button>
  );
}
