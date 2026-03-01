'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { UISelect } from '@/components/ui/Select';
import styles from '@/app/clients/ClientForm.module.css';

type ClientFormState = {
  type: string;
  name: string;
  relacoesComerciais: Array<'CLIENTE' | 'FUNCIONARIO'>;

  cpf: string;
  rg: string;

  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  contribuinte: string;
  inscricaoEstadual: string;
  ufInscricaoEstadual: string;

  email: string;
  phone: string;

  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

type Props = {
  mode: 'new' | 'edit';
  clientId?: string;
  initial: ClientFormState;
  title: string;
  subtitle: string;
  backHref: string;
  submitLabel: string;
};

function onlyDigits(v: string) {
  return v.replace(/\D+/g, '');
}

function maskCpf(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskCnpj(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function maskCep(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  return d.replace(/(\d{5})(\d)/, '$1-$2');
}

function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

export default function ClientForm({
  mode,
  clientId,
  initial,
  title,
  subtitle,
  backHref,
  submitLabel,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ClientFormState>(initial);
  const [relationQuery, setRelationQuery] = useState('');
  const [relationOpen, setRelationOpen] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [cepBusy, setCepBusy] = useState(false);
  const relationRef = useRef<HTMLDivElement | null>(null);
  const relationBoxRef = useRef<HTMLDivElement | null>(null);
  const relationInputRef = useRef<HTMLInputElement | null>(null);
  const isEdit = mode === 'edit';
  const formErrorId = 'client-form-error';
  const lockCpf = isEdit && !!initial.cpf?.trim();
  const lockCnpj = isEdit && !!initial.cnpj?.trim();
  const errText = err.toLowerCase();
  const relationInvalid = errText.includes('relação comercial');
  const ufIeInvalid = errText.includes('uf da inscrição estadual');
  const contribuinteInvalid = errText.includes('contribuinte icms');

  const ufList = [
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
  ];
  const relacoesDisponiveis: Array<{ value: 'CLIENTE' | 'FUNCIONARIO'; label: string }> = [
    { value: 'CLIENTE', label: 'Cliente' },
    { value: 'FUNCIONARIO', label: 'Funcionário' },
  ];

  function addRelacao(value: 'CLIENTE' | 'FUNCIONARIO') {
    setForm((prev) => {
      const current = Array.isArray(prev.relacoesComerciais) ? prev.relacoesComerciais : [];
      if (current.includes(value)) return prev;
      return { ...prev, relacoesComerciais: [...current, value] };
    });
    setRelationQuery('');
    setRelationOpen(false);
    setTimeout(() => {
      relationInputRef.current?.blur();
      if (relationBoxRef.current) relationBoxRef.current.scrollLeft = 0;
    }, 0);
  }

  function removeRelacaoAt(indexToRemove: number) {
    setForm((prev) => ({
      ...prev,
      relacoesComerciais: (Array.isArray(prev.relacoesComerciais) ? prev.relacoesComerciais : []).filter((_, index) => index !== indexToRemove),
    }));
    setTimeout(() => relationInputRef.current?.focus(), 0);
  }

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!relationRef.current || !target) return;
      if (!relationRef.current.contains(target)) {
        setRelationOpen(false);
      }
    }
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, []);

  const relationSuggestions = relacoesDisponiveis.filter((item) => {
    if (form.relacoesComerciais.includes(item.value)) return false;
    if (!relationQuery.trim()) return true;
    return item.label.toLowerCase().includes(relationQuery.trim().toLowerCase());
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setSaving(true);

    if (form.type === 'PJ' && form.contribuinte === 'CONTRIBUINTE_ICMS') {
      if (!form.inscricaoEstadual.trim()) {
        setErr('Inscrição estadual é obrigatória para contribuinte ICMS.');
        setSaving(false);
        return;
      }
      if (!form.ufInscricaoEstadual.trim()) {
        setErr('UF da inscrição estadual é obrigatória para contribuinte ICMS.');
        setSaving(false);
        return;
      }
    }

    if (!Array.isArray(form.relacoesComerciais) || form.relacoesComerciais.length === 0) {
      setErr('Selecione ao menos uma relação comercial.');
      setSaving(false);
      return;
    }

    const payload = {
      type: form.type,
      name: form.name,
      relacoesComerciais: form.relacoesComerciais,

      cpf: form.cpf || null,
      rg: form.rg || null,

      cnpj: form.cnpj || null,
      razaoSocial: form.razaoSocial || null,
      nomeFantasia: form.nomeFantasia || null,
      contribuinte: form.contribuinte || null,
      inscricaoEstadual: form.inscricaoEstadual || null,
      ufInscricaoEstadual: form.ufInscricaoEstadual || null,

      email: form.email || null,
      phone: form.phone || null,

      cep: form.cep || null,
      logradouro: form.logradouro || null,
      numero: form.numero || null,
      complemento: form.complemento || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      uf: form.uf || null,
    };

    try {
      const url = mode === 'edit' ? `/api/clients/${clientId}` : '/api/clients';
      const method = mode === 'edit' ? 'PATCH' : 'POST';
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const raw = await resp.text().catch(() => '');
        let message = raw;
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.message) message = parsed.message;
        } catch {}
        throw new Error(message || 'Erro ao salvar pessoa.');
      }
      router.push('/clients');
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleCepBlur() {
    const raw = (form.cep || '').replace(/\D+/g, '');
    if (raw.length !== 8) return;
    setCepBusy(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      if (!resp.ok) throw new Error('CEP não encontrado');
      const data = await resp.json();
      if (data?.erro) throw new Error('CEP não encontrado');
      setForm((prev) => ({
        ...prev,
        cep: raw,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        uf: data.uf || prev.uf,
      }));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setCepBusy(false);
    }
  }

  return (
    <main className={`${styles.page} appPageShell`}>
      <SectionHeader
        title={title}
        description={subtitle}
        headingAs="h1"
        className={styles.header}
        actions={<Link href={backHref} className={styles.linkMuted}>← Voltar</Link>}
      />

      <section className={styles.card}>
        <form onSubmit={submit} className={styles.form} suppressHydrationWarning>
          <div className={styles.row}>
              <label className={styles.label}>
                <span>Tipo</span>
                <UISelect
                  className={styles.input}
                  value={form.type}
                  onChange={(value) => setForm({ ...form, type: value })}
                  ariaLabel="Tipo"
                  ariaDescribedBy={err ? formErrorId : undefined}
                  options={[
                    { value: 'PF', label: 'Pessoa Física' },
                    { value: 'PJ', label: 'Pessoa Jurídica' },
                  ]}
                />
              </label>
            <label className={styles.label}>
              <span>Relações comerciais</span>
              <div className={styles.relationWrap} ref={relationRef}>
                <div className={styles.relationBox} ref={relationBoxRef}>
                  {form.relacoesComerciais.map((item, index) => {
                    const label = item === 'CLIENTE' ? 'CLIENTE' : 'FUNCIONÁRIO';
                    return (
                      <span key={`${item}-${index}`} className={`${styles.relationChip} ${styles.relationChipActive}`}>
                        <span>{label}</span>
                        <button
                          type="button"
                          className={styles.relationRemove}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeRelacaoAt(index);
                          }}
                          aria-label={`Remover ${label}`}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                  <input
                    ref={relationInputRef}
                    className={styles.relationInput}
                    value={relationQuery}
                    onChange={(e) => {
                      setRelationQuery(e.target.value);
                      setRelationOpen(true);
                    }}
                    onFocus={() => {
                      setRelationOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (relationSuggestions[0]) {
                          addRelacao(relationSuggestions[0].value);
                        }
                      }
                    }}
                    placeholder={form.relacoesComerciais.length ? '' : 'Digite Cliente ou Funcionário'}
                    aria-invalid={relationInvalid || undefined}
                    aria-describedby={err ? formErrorId : undefined}
                  />
                </div>
                {relationOpen && relationSuggestions.length > 0 ? (
                  <div className={styles.relationDropdown}>
                    {relationSuggestions.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={styles.relationOption}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addRelacao(item.value);
                        }}
                      >
                        {item.label.toUpperCase()}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </label>
          </div>

          {form.type === 'PF' ? (
            <>
              <div className={styles.row}>
                <label className={styles.label}>
                  <span>Nome</span>
                  <input
                    className={styles.input}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </label>
                <label className={styles.label}>
                  <span>CPF</span>
                  <input
                    className={`${styles.input} ${lockCpf ? styles.inputDisabled : ''}`}
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: maskCpf(e.target.value) })}
                    placeholder="000.000.000-00"
                    required
                    disabled={lockCpf}
                  />
                </label>
                <label className={styles.label}>
                  <span>RG</span>
                  <input
                    className={styles.input}
                    value={form.rg}
                    onChange={(e) => setForm({ ...form, rg: e.target.value })}
                    placeholder="RG"
                  />
                </label>
              </div>
              <div className={styles.row}>
                <label className={styles.label}>
                  <span>Email</span>
                  <input
                    className={styles.input}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </label>
                <label className={styles.label}>
                  <span>Telefone</span>
                  <input
                    className={styles.input}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
                    placeholder="(11) 99999-0000"
                  />
                </label>
              </div>
            </>
          ) : (
            <>
              <div className={styles.row}>
                <label className={styles.label}>
                  <span>CNPJ</span>
                  <input
                    className={`${styles.input} ${lockCnpj ? styles.inputDisabled : ''}`}
                    value={form.cnpj}
                    onChange={(e) => setForm({ ...form, cnpj: maskCnpj(e.target.value) })}
                    placeholder="00.000.000/0000-00"
                    required
                    disabled={lockCnpj}
                  />
                </label>
                <label className={styles.label}>
                  <span>Razão social</span>
                  <input
                    className={styles.input}
                    value={form.razaoSocial}
                    onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                    required
                  />
                </label>
                <label className={styles.label}>
                  <span>Nome fantasia</span>
                  <input
                    className={styles.input}
                    value={form.nomeFantasia}
                    onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
                  />
                </label>
              </div>

              <div className={styles.row}>
                  <label className={styles.label}>
                    <span>Tipo de contribuinte</span>
                    <UISelect
                      className={styles.input}
                      value={form.contribuinte}
                      onChange={(value) => setForm({ ...form, contribuinte: value })}
                      ariaLabel="Tipo de contribuinte"
                      ariaDescribedBy={err ? formErrorId : undefined}
                      ariaInvalid={contribuinteInvalid}
                      options={[
                        { value: 'NAO_CONTRIBUINTE', label: 'Não contribuinte' },
                        { value: 'CONTRIBUINTE_ICMS', label: 'Contribuinte ICMS' },
                        { value: 'CONTRIBUINTE_ISENTO_IE', label: 'Contribuinte isento de IE' },
                      ]}
                    />
                  </label>
                <label className={styles.label}>
                  <span>Inscrição estadual</span>
                  <input
                    className={styles.input}
                    value={form.inscricaoEstadual}
                    onChange={(e) => setForm({ ...form, inscricaoEstadual: e.target.value })}
                    required={form.contribuinte === 'CONTRIBUINTE_ICMS'}
                    placeholder={form.contribuinte === 'CONTRIBUINTE_ICMS' ? 'Obrigatório' : 'Opcional'}
                  />
                </label>
                  <label className={styles.label}>
                    <span>UF da inscrição</span>
                    <UISelect
                      className={styles.input}
                      value={form.ufInscricaoEstadual}
                      onChange={(value) => setForm({ ...form, ufInscricaoEstadual: value })}
                      ariaLabel="UF da inscrição"
                      ariaDescribedBy={err ? formErrorId : undefined}
                      ariaInvalid={ufIeInvalid}
                      required={form.contribuinte === 'CONTRIBUINTE_ICMS'}
                      options={[
                        { value: '', label: 'Selecione' },
                        ...ufList.map((uf) => ({ value: uf, label: uf })),
                      ]}
                    />
                  </label>
              </div>

              <div className={styles.row}>
                <label className={styles.label}>
                  <span>Email</span>
                  <input
                    className={styles.input}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </label>
                <label className={styles.label}>
                  <span>Telefone</span>
                  <input
                    className={styles.input}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
                    placeholder="(11) 99999-0000"
                  />
                </label>
              </div>
            </>
          )}

          <div className={styles.row}>
                <label className={styles.label}>
                  <span>CEP</span>
                  <input
                    className={styles.input}
                    value={form.cep}
                    onChange={(e) => setForm({ ...form, cep: maskCep(e.target.value) })}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                  />
                </label>
            <label className={styles.label}>
              <span>Logradouro</span>
              <input
                className={styles.input}
                value={form.logradouro}
                onChange={(e) => setForm({ ...form, logradouro: e.target.value })}
              />
            </label>
            <label className={styles.label}>
              <span>Número</span>
              <input
                className={styles.input}
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
              />
            </label>
          </div>
          <div className={styles.row}>
            <label className={styles.label}>
              <span>Complemento</span>
              <input
                className={styles.input}
                value={form.complemento}
                onChange={(e) => setForm({ ...form, complemento: e.target.value })}
              />
            </label>
            <label className={styles.label}>
              <span>Bairro</span>
              <input
                className={styles.input}
                value={form.bairro}
                onChange={(e) => setForm({ ...form, bairro: e.target.value })}
              />
            </label>
            <label className={styles.label}>
              <span>Cidade</span>
              <input
                className={styles.input}
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              />
            </label>
          </div>
          <div className={styles.row}>
              <label className={styles.label}>
                <span>UF</span>
                <UISelect
                  className={styles.input}
                  value={form.uf}
                  onChange={(value) => setForm({ ...form, uf: value })}
                  ariaLabel="UF"
                  ariaDescribedBy={err ? formErrorId : undefined}
                  options={[
                    { value: '', label: 'Selecione' },
                    ...ufList.map((uf) => ({ value: uf, label: uf })),
                  ]}
                />
              </label>
            {cepBusy ? <div className={styles.helper}>Buscando CEP...</div> : null}
          </div>

          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={saving}>
              {saving ? 'Salvando...' : submitLabel}
            </button>
            <Link href={backHref} className={styles.ghostButton}>
              Cancelar
            </Link>
          </div>

          {err ? <div id={formErrorId} className={styles.error}>{err}</div> : null}
        </form>
      </section>
    </main>
  );
}
