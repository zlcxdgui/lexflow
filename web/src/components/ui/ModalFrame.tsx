'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import ui from './ui.module.css';

export function ModalFrame({
  open,
  onClose,
  children,
  size = 'md',
  closeOnOverlay = true,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'md' | 'lg';
  closeOnOverlay?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className={ui.dialogOverlay} onClick={closeOnOverlay ? onClose : undefined}>
      <div
        className={`${ui.modalFrameCard} ${size === 'lg' ? ui.modalFrameCardLg : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

