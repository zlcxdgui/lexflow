'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './HeaderMenu.module.css';
import { CalculatorIcon, calculatorLinks, getAppMenuLinks } from './appNav';

type HeaderMenuProps = {
  enabled: boolean;
  role?: string;
};

export default function HeaderMenu({ enabled, role }: HeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const finalLinks = getAppMenuLinks(role);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = prevOverflow || '';
    }
    return () => {
      document.body.style.overflow = prevOverflow || '';
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
    setCalcOpen(false);
    setFinanceOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className={styles.menuButton}
        onClick={() => enabled && setOpen(true)}
        disabled={!enabled}
        aria-label="Abrir menu"
      >
        <span />
        <span />
        <span />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div className={styles.overlay} onClick={closeMenu}>
              <aside className={styles.drawer} onClick={(e) => e.stopPropagation()}>
                <nav className={styles.drawerNav}>
                  {finalLinks.map((item) => {
                    if (item.children?.length) {
                      return (
                        <div key={item.href} className={styles.drawerGroup}>
                          <button
                            type="button"
                            className={styles.drawerGroupButton}
                            onClick={() => setFinanceOpen((prev) => !prev)}
                          >
                            <span className={styles.icon}>{item.icon}</span>
                            {item.label}
                            <span className={styles.groupChevron}>{financeOpen ? '▲' : '▼'}</span>
                          </button>
                          {financeOpen
                            ? item.children.map((child) => (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className={styles.drawerSubLink}
                                  onClick={closeMenu}
                                >
                                  {child.label}
                                </Link>
                              ))
                            : null}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={styles.drawerLink}
                        onClick={closeMenu}
                      >
                        <span className={styles.icon}>{item.icon}</span>
                        {item.label}
                      </Link>
                    );
                  })}
                  <button
                    type="button"
                    className={styles.drawerGroupButton}
                    onClick={() => setCalcOpen((prev) => !prev)}
                  >
                    <span className={styles.icon}><CalculatorIcon /></span>
                    Calculadoras
                    <span className={styles.groupChevron}>{calcOpen ? '▲' : '▼'}</span>
                  </button>
                  {calcOpen
                    ? calculatorLinks.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={styles.drawerSubLink}
                          onClick={closeMenu}
                        >
                          {item.label}
                        </Link>
                      ))
                    : null}
                </nav>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
