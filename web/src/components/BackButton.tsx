'use client';

import { useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';

type BackButtonProps = {
  className?: string;
  fallbackHref?: string;
  label?: string;
};

export function BackButton({
  className,
  fallbackHref = '/dashboard',
  label = '← Voltar',
}: BackButtonProps) {
  const router = useRouter();

  function isInternalReferrer() {
    if (typeof window === 'undefined') return false;
    if (!document.referrer) return false;
    try {
      const ref = new URL(document.referrer);
      return ref.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (typeof window !== 'undefined' && window.history.length > 1 && isInternalReferrer()) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <a href={fallbackHref} className={className} onClick={onClick}>
      {label}
    </a>
  );
}
