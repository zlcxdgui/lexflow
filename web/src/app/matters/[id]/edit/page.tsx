'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { UISelect } from '@/components/ui/Select';
import { useCan } from '@/hooks/useCan';
import styles from './edit.module.css';

type ClientOption = {
  id: string;
  name: string;
  code?: number | null;
};

type Matter = {
  id: string;
  title: string;
  clientId: string | null;
  caseNumber: string | null;
  area: string | null;
  subject: string | null;
  court: string | null;
  status: 'OPEN' | 'CLOSED';
};

function parseError(raw: string, fallback: string) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.message === 'string') return parsed.message;
    if (Array.isArray(parsed?.message) && parsed.message.length) return String(parsed.message[0]);
  } catch {}
  return raw || fallback;
}

export default function EditMatterPage() {
  const { can, loading: loadingPerm } = useCan();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = useMemo(() => String(params?.id || ''), [params]);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const formErrorId = 'edit-matter-form-error';
  const [lockedByClosed, setLockedByClosed] = useState(false);

  const [form, setForm] = useState({
    title: '',
    clientId: '',
    caseNumber: '',
    area: '',
    subject: '',
    court: '',
  });

  useEffect(() => {
    if (!id) return;
    if (!can('matter.edit')) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [matterResp, clientsResp] = await Promise.all([
          fetch(`/api/matters/${id}`, { cache: 'no-store' }),
          fetch('/api/clients', { cache: 'no-store' }),
        ]);

        if (!matterResp.ok) {
          const txt = await matterResp.text().catch(() => '');
          throw new Error(parseError(txt, 'Não foi possível carregar caso.'));
        }
        if (!clientsResp.ok) {
          throw new Error('Não foi possível carregar pessoas.');
        }

        const matter = (await matterResp.json()) as Matter;
        const clientsData = await clientsResp.json();

        setClients(Array.isArray(clientsData) ? clientsData : []);
        setForm({
          title: matter.title || '',
          clientId: matter.clientId || '',
          caseNumber: matter.caseNumber || '',
          area: matter.area || '',
          subject: matter.subject || '',
          court: matter.court || '',
        });
        setLockedByClosed(matter.status === 'CLOSED');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Falha ao carregar caso.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, can]);

  if (!loadingPerm && !can('matter.edit')) {
    return (
      <main className={`${styles.page} appPageShell`}>
        <section className={styles.card}>Você não tem permissão para editar caso.</section>
      </main>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;

    setError('');
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        clientId: form.clientId || null,
        caseNumber: form.caseNumber.trim() || null,
        area: form.area.trim() || null,
        subject: form.subject.trim() || null,
        court: form.court.trim() || null,
      };

      const resp = await fetch(`/api/matters/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(parseError(txt, 'Não foi possível salvar o caso.'));
      }

      router.replace(`/matters/${id}`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar caso.');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className={`${styles.page} appPageShell`}>
        <section className={styles.card}>Carregando caso...</section>
      </main>
    );
  }

  return (
    <main className={`${styles.page} appPageShell`}>
      <SectionHeader
        title="Editar caso"
        description="Atualize pessoa, área, assunto, vara e dados do processo."
        headingAs="h1"
        className={styles.header}
        actions={<BackButton fallbackHref={`/matters/${id}`} className={styles.linkMuted} />}
      />

      <section className={styles.card}>
        {lockedByClosed ? (
          <div className={styles.lockNotice}>
            Caso encerrado: para editar dados, reabra o caso na tela principal.
          </div>
        ) : null}
        <form className={styles.form} onSubmit={onSubmit} suppressHydrationWarning>
          <div className={styles.row}>
            <label className={styles.label}>
              <span>Título</span>
              <input
                className={styles.input}
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                disabled={lockedByClosed}
                required
              />
            </label>
              <label className={styles.label}>
                <span>Pessoa</span>
                <UISelect
                  className={styles.input}
                  value={form.clientId}
                  onChange={(value) => setForm((prev) => ({ ...prev, clientId: value }))}
                  disabled={lockedByClosed}
                  ariaLabel="Pessoa vinculada"
                  ariaDescribedBy={error ? formErrorId : undefined}
                  placeholder="Sem pessoa vinculada"
                  options={[
                    { value: '', label: 'Sem pessoa vinculada' },
                    ...clients.map((client) => ({
                      value: client.id,
                      label: `${client.code ? `${client.code} - ` : ''}${client.name}`,
                    })),
                  ]}
                />
              </label>
          </div>

          <div className={styles.row}>
            <label className={styles.label}>
              <span>Número do processo</span>
              <input
                className={styles.input}
                value={form.caseNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, caseNumber: e.target.value }))}
                disabled={lockedByClosed}
                placeholder="0000000-00.0000.0.00.0000"
              />
            </label>
            <label className={styles.label}>
              <span>Vara / Tribunal</span>
              <input
                className={styles.input}
                value={form.court}
                onChange={(e) => setForm((prev) => ({ ...prev, court: e.target.value }))}
                disabled={lockedByClosed}
                placeholder="Ex: TJSP"
              />
            </label>
          </div>

          <div className={styles.row}>
            <label className={styles.label}>
              <span>Área</span>
              <input
                className={styles.input}
                value={form.area}
                onChange={(e) => setForm((prev) => ({ ...prev, area: e.target.value }))}
                disabled={lockedByClosed}
                placeholder="Ex: Cível"
              />
            </label>
            <label className={styles.label}>
              <span>Assunto</span>
              <input
                className={styles.input}
                value={form.subject}
                onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                disabled={lockedByClosed}
                placeholder="Ex: Cobrança"
              />
            </label>
          </div>

          <div className={styles.actions}>
            {!lockedByClosed ? (
              <button type="submit" className={styles.primaryButton} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            ) : null}
            <Link href={`/matters/${id}`} className={styles.ghostButton}>
              {lockedByClosed ? 'Voltar ao caso' : 'Cancelar'}
            </Link>
          </div>

          {error ? <div id={formErrorId} className={styles.error}>{error}</div> : null}
        </form>
      </section>
    </main>
  );
}
