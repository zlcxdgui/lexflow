'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ActionMenu.module.css';

export function ActionMenu({
  triggerAriaLabel,
  children,
}: {
  triggerAriaLabel: string;
  children: (ctx: { close: () => void }) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number }>({ left: 12, top: 12 });

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const placeMenu = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;

      const r = trigger.getBoundingClientRect();
      const menuW = menu.offsetWidth || 220;
      const menuH = menu.offsetHeight || 180;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pad = 8;

      const spaceRight = vw - r.right - pad;
      const spaceLeft = r.left - pad;
      const openRight = spaceRight >= menuW || spaceRight >= spaceLeft;

      let left = openRight ? r.left : r.right - menuW;
      if (left < pad) left = pad;
      if (left + menuW > vw - pad) left = Math.max(pad, vw - pad - menuW);

      let top = r.bottom + 4;
      if (top + menuH > vh - pad) {
        const upTop = r.top - menuH - 4;
        top = upTop > pad ? upTop : Math.max(pad, vh - pad - menuH);
      }

      setMenuPos({ left, top });
    };

    placeMenu();
    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    return () => {
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={triggerAriaLabel}
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        ⚙
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className={styles.menu}
              style={{ left: menuPos.left, top: menuPos.top }}
              onClick={(e) => e.stopPropagation()}
            >
              {children({ close: () => setOpen(false) })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
