'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '@/app/matters/[id]/matter.module.css';
import { UISelect } from './ui/Select';

export function CreateMatterUpdateForm({ matterId }: { matterId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('GERAL');
  const [eventDate, setEventDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const formErrorId = 'create-matter-update-form-error';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const resp = await fetch(`/api/matters/${matterId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, type, eventDate: eventDate || undefined }),
      });

      const txt = await resp.text();
      if (!resp.ok) {
        let msg = 'Falha ao registrar andamento';
        try {
          const parsed = JSON.parse(txt);
          if (typeof parsed?.message === 'string') msg = parsed.message;
        } catch {}
        throw new Error(msg);
      }

      setTitle('');
      setDescription('');
      setType('GERAL');
      setEventDate('');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar andamento');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.updateForm} onSubmit={onSubmit} suppressHydrationWarning>
      <div className={styles.updateGrid}>
        <label className={styles.updateField}>
          <span>Título do andamento</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Protocolo de petição"
            className={styles.updateInput}
            required
          />
        </label>

          <label className={styles.updateField}>
            <span>Tipo</span>
            <UISelect
              value={type}
              onChange={setType}
              className={styles.updateInput}
              ariaLabel="Tipo de andamento"
              ariaDescribedBy={error ? formErrorId : undefined}
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
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className={styles.updateInput}
          />
        </label>
      </div>

      <label className={styles.updateField}>
        <span>Descrição</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva o andamento de forma objetiva"
          className={styles.updateTextarea}
          required
        />
      </label>

      <div className={styles.updateActions}>
        <button type="submit" className={styles.updateButton} disabled={saving}>
          {saving ? 'Salvando...' : 'Registrar andamento'}
        </button>
      </div>
      {error ? <div id={formErrorId} className={styles.updateError}>{error}</div> : null}
    </form>
  );
}
