'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import ui from './ui.module.css';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: 'primary' | 'danger';
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmTone = 'primary',
  busy = false,
  error,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
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
    <div className={ui.dialogOverlay} onClick={busy ? undefined : onClose}>
      <div className={ui.dialogCard} onClick={(e) => e.stopPropagation()}>
        <h3 className={ui.dialogTitle}>{title}</h3>
        {description ? <div className={ui.dialogText}>{description}</div> : null}
        {error ? <div className={ui.dialogError}>{error}</div> : null}
        <div className={ui.dialogActions}>
          <button
            type="button"
            className={`${ui.button} ${ui.buttonSecondary}`}
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${ui.button} ${confirmTone === 'danger' ? ui.buttonDanger : ui.buttonPrimary}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
