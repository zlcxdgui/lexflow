'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '@/app/matters/[id]/matter.module.css';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { ModalFrame } from './ui/ModalFrame';
import { UISelect } from './ui/Select';

type MatterUpdate = {
  id: string;
  title: string;
  description: string;
  type: string;
  eventDate?: string | null;
};

function extractMessage(raw: string, fallback: string) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.message === 'string') return parsed.message;
    if (Array.isArray(parsed?.message) && parsed.message.length) {
      return String(parsed.message[0]);
    }
  } catch {}
  return raw || fallback;
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function MatterUpdateActions({
  matterId,
  update,
  canEdit = true,
  canDelete = true,
}: {
  matterId: string;
  update: MatterUpdate;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<null | 'edit' | 'delete' | 'history'>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const modalErrorId = `matter-update-actions-error-${update.id}`;
  const [history, setHistory] = useState<
    Array<{
      id: string;
      action: string;
      createdAt: string;
      user?: { id: string; name: string; email: string } | null;
      changes?: Array<{ field: string; from: unknown; to: unknown }>;
    }>
  >([]);
  const [title, setTitle] = useState(update.title);
  const [description, setDescription] = useState(update.description);
  const [type, setType] = useState(update.type || 'GERAL');
  const [eventDate, setEventDate] = useState(toDateInput(update.eventDate));

  const disableSave = useMemo(
    () => !title.trim() || !description.trim() || saving,
    [description, saving, title],
  );

  function closeModal() {
    if (saving) return;
    setMode(null);
    setError('');
  }

  async function openHistory() {
    setError('');
    setHistoryLoading(true);
    setMode('history');
    try {
      const resp = await fetch(
        `/api/matters/${matterId}/updates/${update.id}/history`,
        { cache: 'no-store' },
      );
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(extractMessage(txt, 'Não foi possível carregar histórico'));
      }
      const data = await resp.json().catch(() => []);
      setHistory(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível carregar histórico',
      );
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function saveEdit() {
    if (disableSave) return;
    setSaving(true);
    setError('');
    try {
      const resp = await fetch(`/api/matters/${matterId}/updates/${update.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          type,
          eventDate: eventDate || null,
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(extractMessage(txt, 'Não foi possível atualizar andamento'));
      }
      setMode(null);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível atualizar andamento',
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteUpdate() {
    setSaving(true);
    setError('');
    try {
      const resp = await fetch(`/api/matters/${matterId}/updates/${update.id}`, {
        method: 'DELETE',
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(extractMessage(txt, 'Não foi possível excluir andamento'));
      }
      setMode(null);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível excluir andamento',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={styles.timelineActions}>
        <button
          type="button"
          className={styles.actionButton}
          onClick={openHistory}
        >
          Histórico
        </button>
        {canEdit ? (
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => setMode('edit')}
          >
            Editar
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            className={`${styles.actionButton} ${styles.actionButtonDanger}`}
            onClick={() => setMode('delete')}
          >
            Excluir
          </button>
        ) : null}
      </div>

      {mode === 'delete' ? (
        <ConfirmDialog
          open
          title="Excluir andamento"
          description={
            <>
              Essa ação é permanente e não pode ser desfeita.
              <br />
              Confirma excluir o andamento <b>{update.title}</b>?
            </>
          }
          confirmLabel={saving ? 'Excluindo...' : 'Excluir'}
          confirmTone="danger"
          busy={saving}
          error={error}
          onClose={closeModal}
          onConfirm={deleteUpdate}
        />
      ) : null}

      {mode && mode !== 'delete' ? (
        <ModalFrame open onClose={closeModal} size={mode === 'history' ? 'lg' : 'md'}>
          <div>
            {mode === 'edit' ? (
              <>
                <h3 className={styles.modalTitle}>Editar andamento</h3>
                <div className={styles.updateForm}>
                  <label className={styles.updateField}>
                    <span>Título</span>
                    <input
                      className={styles.updateInput}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                    <label className={styles.updateField}>
                      <span>Tipo</span>
                      <UISelect
                        className={styles.updateInput}
                        value={type}
                        onChange={setType}
                        ariaLabel="Tipo"
                        ariaDescribedBy={error ? modalErrorId : undefined}
                        options={[
                          { value: 'GERAL', label: 'Geral' },
                          { value: 'PROCESSUAL', label: 'Processual' },
                          { value: 'AUDIENCIA', label: 'Audiência' },
                          { value: 'ATENDIMENTO', label: 'Atendimento' },
                        ]}
                      />
                    </label>
                  <label className={styles.updateField}>
                    <span>Data do evento</span>
                    <input
                      type="date"
                      className={styles.updateInput}
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                    />
                  </label>
                  <label className={styles.updateField}>
                    <span>Descrição</span>
                    <textarea
                      className={styles.updateTextarea}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <h3 className={styles.modalTitle}>Histórico do andamento</h3>
                {historyLoading ? (
                  <p className={styles.modalText}>Carregando...</p>
                ) : history.length === 0 ? (
                  <p className={styles.modalText}>Sem histórico disponível.</p>
                ) : (
                  <div className={styles.historyList}>
                    {history.map((item) => (
                      <div key={item.id} className={styles.historyItem}>
                        <div className={styles.historyTitle}>
                          {item.action === 'MATTER_UPDATE_ADDED'
                            ? 'Criado'
                            : item.action === 'MATTER_UPDATE_UPDATED'
                            ? 'Editado'
                            : 'Excluído'}
                        </div>
                        <div className={styles.historyMeta}>
                          {new Date(item.createdAt).toLocaleDateString('pt-BR')}{' '}
                          · {item.user?.name || 'Sistema'}
                        </div>
                        {item.changes && item.changes.length > 0 ? (
                          <ul className={styles.historyChanges}>
                            {item.changes.map((change) => (
                              <li key={`${item.id}-${change.field}`}>
                                <b>{change.field}</b>: {String(change.from ?? '-')} →{' '}
                                {String(change.to ?? '-')}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {error ? <div id={modalErrorId} className={styles.updateError}>{error}</div> : null}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={closeModal}
                disabled={saving}
              >
                Cancelar
              </button>
              {mode === 'edit' ? (
                <button
                  type="button"
                  className={styles.updateButton}
                  onClick={saveEdit}
                  disabled={disableSave}
                >
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </button>
              ) : null}
              {mode === 'history' ? (
                <button
                  type="button"
                  className={styles.updateButton}
                  onClick={closeModal}
                >
                  Fechar
                </button>
              ) : null}
            </div>
          </div>
        </ModalFrame>
      ) : null}
    </>
  );
}
