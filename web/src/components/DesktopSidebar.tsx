'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './DesktopSidebar.module.css';
import { CalculatorIcon, calculatorLinks, getAppMenuLinks } from './appNav';

type Props = {
  enabled: boolean;
  role?: string;
};

export default function DesktopSidebar({ enabled, role }: Props) {
  const pathname = usePathname();
  if (!enabled) return null;
  const links = getAppMenuLinks(role);

  return (
    <aside className={styles.sidebar} aria-label="Menu principal">
      <div className={styles.sectionLabel}>Menu</div>
      <nav className={styles.nav}>
        {links.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
          const children = item.children ?? [];
          const groupOpen = active || children.some((child) => pathname === child.href);
          return (
            <div key={item.href} className={styles.navGroup}>
              <Link
                href={item.href}
                className={`${styles.link} ${active ? styles.linkActive : ''}`}
              >
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.linkText}>{item.label}</span>
              </Link>
              {children.length && groupOpen ? (
                <div className={styles.groupSubNav}>
                  {children.map((child) => {
                    const childActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`${styles.subLink} ${childActive ? styles.subLinkActive : ''}`}
                      >
                        <span className={styles.iconSmall}>{child.icon}</span>
                        <span className={styles.subLinkText}>{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className={styles.block}>
        <div className={styles.sectionLabel}>Utilitários</div>
        <div className={styles.subNav}>
          {calculatorLinks.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.subLink} ${active ? styles.subLinkActive : ''}`}
              >
                <span className={styles.iconSmall}><CalculatorIcon /></span>
                <span className={styles.subLinkText}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
