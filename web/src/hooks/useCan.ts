'use client';

import { useEffect, useMemo, useState } from 'react';
import { can, normalizeRole, type AppRole, type PermissionAction } from '@/lib/permissions';

type MeResp = { role?: string; permissions?: string[] };

export function useCan() {
  const [role, setRole] = useState<AppRole>('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const resp = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!resp.ok) {
          if (active) {
            setRole('');
            setPermissions([]);
          }
          return;
        }
        const data = (await resp.json()) as MeResp;
        if (active) {
          setRole(normalizeRole(data?.role));
          setPermissions(Array.isArray(data?.permissions) ? data.permissions : []);
        }
      } catch {
        if (active) {
          setRole('');
          setPermissions([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const api = useMemo(
    () => ({
      role,
      permissions,
      loading,
      can: (action: PermissionAction) => can(role, action, permissions),
    }),
    [role, permissions, loading],
  );

  return api;
}
