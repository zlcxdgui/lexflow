'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './MatterStatusAction.module.css';
import { ModalFrame } from './ui/ModalFrame';

function parseMessage(raw: string, fallback: string) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.message === 'string') return parsed.message;
    if (Array.isArray(parsed?.message) && parsed.message.length) return String(parsed.message[0]);
  } catch {}
  return raw || fallback;
}

export function MatterStatusAction({
  matterId,
  status,
}: {
  matterId: string;
  status: 'OPEN' | 'CLOSED';
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const nextStatus = status === 'OPEN' ? 'CLOSED' : 'OPEN';
  const isClosing = nextStatus === 'CLOSED';

  async function submit() {
    setError('');
    if (isClosing && !reason.trim()) {
      setError('Informe o motivo para encerrar o caso.');
      return;
    }
    setSaving(true);
    try {
      const resp = await fetch(`/api/matters/${matterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          statusReason: reason.trim() || null,
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(parseMessage(txt, 'Não foi possível atualizar status do caso.'));
      }
      setOpen(false);
      setReason('');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar status do caso.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        className={`${styles.button} ${status === 'OPEN' ? styles.closeButton : styles.reopenButton}`}
        onClick={() => setOpen(true)}
      >
        {status === 'OPEN' ? 'Encerrar caso' : 'Reabrir caso'}
      </button>

      {open ? (
        <ModalFrame open onClose={() => setOpen(false)}>
          <div>
            <h3 className={styles.title}>{status === 'OPEN' ? 'Encerrar caso' : 'Reabrir caso'}</h3>
            <p className={styles.subtitle}>
              {status === 'OPEN'
                ? 'Este caso ficará como encerrado e sairá da lista de abertos.'
                : 'O caso voltará para aberto e aparecerá novamente nos fluxos ativos.'}
            </p>
            <textarea
              className={styles.textarea}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={status === 'OPEN' ? 'Motivo do encerramento (obrigatório)' : 'Motivo da reabertura (opcional)'}
            />
            {error ? <div className={styles.error}>{error}</div> : null}
            <div className={styles.actions}>
              <button className={styles.ghost} onClick={() => setOpen(false)} disabled={saving}>
                Cancelar
              </button>
              <button className={styles.confirm} onClick={submit} disabled={saving}>
                {saving ? 'Salvando...' : status === 'OPEN' ? 'Confirmar encerramento' : 'Confirmar reabertura'}
              </button>
            </div>
          </div>
        </ModalFrame>
      ) : null}
    </>
  );
}
