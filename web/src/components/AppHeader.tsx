import Link from 'next/link';
import { cookies } from 'next/headers';
import { formatRole } from '@/lib/format';
import styles from './AppHeader.module.css';
import HeaderMenu from './HeaderMenu';
import TenantSwitcher from './TenantSwitcher';
import DesktopSidebar from './DesktopSidebar';
import ThemeToggle from './ThemeToggle';
import LogoutButton from './LogoutButton';

type Me = {
  sub: string;
  tenantId: string;
  role: string;
  tenantRole?: string;
  isAdmin?: boolean;
  email: string;
};

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4a5 5 0 0 0-5 5v2.2c0 .9-.3 1.8-.9 2.5L4.6 16a1 1 0 0 0 .8 1.6h13.2a1 1 0 0 0 .8-1.6l-1.5-2.3c-.6-.7-.9-1.6-.9-2.5V9a5 5 0 0 0-5-5Zm0 17a2.5 2.5 0 0 0 2.4-2h-4.8A2.5 2.5 0 0 0 12 21Z"
        fill="currentColor"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2.2c-3.6 0-7.2 1.8-7.2 4.5a1 1 0 0 0 1 1h12.4a1 1 0 0 0 1-1c0-2.7-3.6-4.5-7.2-4.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.5 4a6.5 6.5 0 1 0 4.09 11.55l4.43 4.43 1.41-1.41-4.43-4.43A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z" fill="currentColor" />
    </svg>
  );
}

function getApiUrl() {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

async function fetchMe(token?: string): Promise<Me | null> {
  if (!token) return null;
  try {
    const resp = await fetch(`${getApiUrl()}/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as Partial<Me>;
    if (!data?.sub || !data?.email || !data?.role || !data?.tenantId) return null;
    return {
      sub: data.sub,
      tenantId: data.tenantId,
      role: data.role,
      tenantRole: data.tenantRole,
      isAdmin: Boolean(data.isAdmin),
      email: data.email,
    };
  } catch {
    return null;
  }
}

export default async function AppHeader() {
  const store = await cookies();
  const token = store.get('lexflow_token')?.value;
  const me = await fetchMe(token);
  const systemName = process.env.NEXT_PUBLIC_SYSTEM_NAME || 'LexFlow';
  let notificationsTotal = 0;

  if (token) {
    try {
      const resp = await fetch(`${getApiUrl()}/dashboard/notifications`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (resp.ok) {
        const json = (await resp.json()) as { unreadTotal?: number; total?: number };
        notificationsTotal = Number(json?.unreadTotal ?? json?.total ?? 0);
      }
    } catch {
      notificationsTotal = 0;
    }
  }

  return (
    <>
      <header className={styles.header} data-has-sidebar={token && me ? 'true' : 'false'}>
        <div className={styles.inner}>
          <div className={styles.zoneLeft}>
            <HeaderMenu enabled={Boolean(me)} role={me?.role} />
            <Link href="/" className={styles.brand}>
              <span className={styles.systemName}>{systemName}</span>
            </Link>
          </div>

          {token && me ? (
            <div className={styles.zoneCenter}>
              <button type="button" className={styles.topSearch} aria-label="Busca (em breve)">
                <span className={styles.topSearchIcon}>
                  <SearchIcon />
                </span>
                <span className={styles.topSearchPlaceholder}>Pesquisar casos, clientes, tarefas...</span>
                <span className={styles.topSearchKey}>/</span>
              </button>
            </div>
          ) : (
            <div className={styles.zoneCenter} />
          )}

          <div className={styles.zoneRight}>
            {!token || !me ? (
              <Link href="/login" className={styles.button}>
                Entrar
              </Link>
            ) : (
              <>
                <div className={styles.tenantWrap}>
                  <TenantSwitcher currentTenantId={me.tenantId} role={me.role} />
                </div>
                <div className={styles.iconStack}>
                  <ThemeToggle />
                  <Link href="/notifications" className={styles.iconButton} aria-label="Notificações">
                    <BellIcon />
                    {notificationsTotal > 0 ? (
                      <span className={styles.iconBadge}>
                        {notificationsTotal > 99 ? '99+' : notificationsTotal}
                      </span>
                    ) : null}
                  </Link>
                  <Link href="/profile" className={styles.iconButton} aria-label="Perfil">
                    <UserIcon />
                  </Link>
                </div>
                <div className={styles.userCard}>
                  <div className={styles.userAvatar} aria-hidden="true">
                    {me.email.slice(0, 1).toUpperCase()}
                  </div>
                  <div className={styles.userInfoCompact}>
                    <div className={styles.email}>{me.email}</div>
                    <div className={styles.pill}>{formatRole(me.role)}</div>
                  </div>
                </div>
                <LogoutButton className={styles.button} />
              </>
            )}
          </div>
        </div>
      </header>
      {token && me ? (
        <>
          <DesktopSidebar enabled role={me.role} />
          <div className="appDesktopShellMarker" aria-hidden="true" />
        </>
      ) : null}
    </>
  );
}
