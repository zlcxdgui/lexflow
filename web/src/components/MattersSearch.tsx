'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function MattersSearch({
  className,
  inputClassName,
  buttonClassName,
  showButton = false,
}: {
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  showButton?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlQ = searchParams.get('q') || '';
  const [query, setQuery] = useState(urlQ);

  useEffect(() => {
    setQuery(urlQ);
  }, [urlQ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const next = query.trim();
      if (next) params.set('q', next);
      else params.delete('q');
      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
    }, 250);

    return () => clearTimeout(timer);
  }, [query, pathname, router, searchParams]);

  return (
    <div className={className}>
      <input
        name="q"
        placeholder="Buscar por título ou pessoa..."
        aria-label="Buscar caso"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={inputClassName}
      />
      {showButton ? (
        <button
          className={buttonClassName}
          type="button"
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            const next = query.trim();
            if (next) params.set('q', next);
            else params.delete('q');
            router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
          }}
        >
          Buscar
        </button>
      ) : null}
    </div>
  );
}
