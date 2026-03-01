'use client';

import { useState } from 'react';

type LogoutButtonProps = {
  className?: string;
  redirectTo?: string;
  label?: string;
};

export default function LogoutButton({
  className,
  redirectTo = '/login',
  label = 'Sair',
}: LogoutButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    if (pending) return;
    setPending(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      // Fallback below still navigates away even on network failure.
    } finally {
      window.location.assign(redirectTo);
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleLogout}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? 'Saindo...' : label}
    </button>
  );
}
