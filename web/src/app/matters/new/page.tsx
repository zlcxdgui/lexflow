'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { UISelect } from '@/components/ui/Select';
import { useCan } from '@/hooks/useCan';
import styles from './new.module.css';

type ClientOption = {
  id: string;
  name: string;
  code?: number | null;
};

export default function NewMatterPage() {
  const { can, loading: loadingPerm } = useCan();
  const router = useRouter();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const formErrorId = 'new-matter-form-error';

  const [form, setForm] = useState({
    title: '',
    clientId: '',
    caseNumber: '',
    area: '',
    subject: '',
    court: '',
  });

  useEffect(() => {
    if (!can('matter.create')) {
      setLoadingClients(false);
      return;
    }
    (async () => {
      setLoadingClients(true);
      try {
        const resp = await fetch('/api/clients', { cache: 'no-store' });
        if (!resp.ok) throw new Error('Não foi possível carregar pessoas.');
        const data = await resp.json();
        setClients(Array.isArray(data) ? data : []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoadingClients(false);
      }
    })();
  }, [can]);

  if (!loadingPerm && !can('matter.create')) {
    return (
      <main className={`${styles.page} appPageShell`}>
        <section className={styles.card}>Você não tem permissão para criar caso.</section>
      </main>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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

      const resp = await fetch('/api/matters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const raw = await resp.text().catch(() => '');
        let message = raw || 'Não foi possível criar caso.';
        try {
          const parsed = JSON.parse(raw);
          message = Array.isArray(parsed?.message) ? parsed.message[0] : parsed?.message || message;
        } catch {}
        throw new Error(message);
      }

      const created = await resp.json();
      router.replace(`/matters/${created.id}`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <main className={`${styles.page} appPageShell`}>
      <SectionHeader
        title="Novo caso"
        description="Cadastre os dados principais do caso."
        headingAs="h1"
        className={styles.header}
        actions={<BackButton fallbackHref="/matters" className={styles.linkMuted} />}
      />

      <section className={styles.card}>
        <form className={styles.form} onSubmit={onSubmit} suppressHydrationWarning>
          <div className={styles.row}>
            <label className={styles.label}>
              <span>Título</span>
              <input
                className={styles.input}
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Ação de Cobrança - Empresa X"
                required
              />
            </label>
              <label className={styles.label}>
                <span>Pessoa</span>
                <UISelect
                  className={styles.input}
                  value={form.clientId}
                  onChange={(value) => setForm((prev) => ({ ...prev, clientId: value }))}
                  loading={loadingClients}
                  ariaLabel="Pessoa"
                  ariaDescribedBy={error ? formErrorId : undefined}
                  placeholder="Selecione"
                  options={[
                    { value: '', label: 'Selecione' },
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
                placeholder="0000000-00.0000.0.00.0000"
              />
            </label>
            <label className={styles.label}>
              <span>Vara / Tribunal</span>
              <input
                className={styles.input}
                value={form.court}
                onChange={(e) => setForm((prev) => ({ ...prev, court: e.target.value }))}
                placeholder="Ex: 3ª Vara Cível de Belo Horizonte"
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
                placeholder="Cível, Trabalhista, Tributário..."
              />
            </label>
            <label className={styles.label}>
              <span>Assunto</span>
              <input
                className={styles.input}
                value={form.subject}
                onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Assunto principal"
              />
            </label>
          </div>

          <div className={styles.actions}>
            <button type="submit" className={styles.primaryButton} disabled={saving}>
              {saving ? 'Salvando...' : 'Criar caso'}
            </button>
            <Link href="/matters" className={styles.ghostButton}>Cancelar</Link>
          </div>

          {error ? <div id={formErrorId} className={styles.error}>{error}</div> : null}
        </form>
      </section>
    </main>
  );
}
