'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import styles from './AppHeader.module.css';
import { UISelect } from '@/components/ui/Select';

type Tenant = {
  id: string;
  name: string;
};

type Membership = {
  tenantId: string;
  tenant: Tenant;
};

type TenantSwitcherProps = {
  currentTenantId?: string | null;
  role?: string | null;
};

export default function TenantSwitcher({ currentTenantId, role }: TenantSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [tenants, setTenants] = useState<Membership[]>([]);
  const [selected, setSelected] = useState<string | undefined>(currentTenantId || undefined);
  const [loading, setLoading] = useState(false);
  const isAdmin = String(role || '').toUpperCase() === 'ADMIN';

  useEffect(() => {
    let active = true;
    fetch('/api/tenants/mine')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        setTenants(list);
        const fromToken = currentTenantId || '';
        const hasToken = !!fromToken && list.some((m) => m.tenantId === fromToken);
        const next = hasToken ? fromToken : list[0]?.tenantId;
        setSelected(next);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [currentTenantId, isAdmin, pathname, router]);

  useEffect(() => {
    if (currentTenantId) setSelected(currentTenantId);
  }, [currentTenantId]);

  const handleChange = async (tenantId: string) => {
    if (!isAdmin) return;
    setSelected(tenantId);
    setLoading(true);
    try {
      const resp = await fetch('/api/tenants/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      if (resp.ok) {
        router.replace(pathname || '/dashboard');
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const currentTenantName = tenants.find((m) => m.tenantId === (selected || currentTenantId))?.tenant?.name || tenants[0]?.tenant?.name;

  if (!isAdmin || tenants.length <= 1) {
    const single = currentTenantName;
    if (!single) return null;
    return (
      <div className={styles.tenantSwitcher}>
        <span className={styles.tenantLabel}>Escritório</span>
        <span className={styles.tenantSingle}>{single}</span>
      </div>
    );
  }

  return (
    <div className={styles.tenantSwitcher}>
      <span className={styles.tenantLabel}>Escritório</span>
      <UISelect
        className={styles.tenantSelect}
        value={selected || ''}
        onChange={handleChange}
        ariaLabel="Selecionar escritório"
        loading={loading}
        placeholder="Selecione um escritório"
        options={tenants.map((m) => ({
          value: m.tenantId,
          label: m.tenant?.name || 'Sem nome',
        }))}
      />
    </div>
  );
}
