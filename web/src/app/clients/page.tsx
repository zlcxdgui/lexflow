'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ActionMenu } from '@/components/ActionMenu';
import { AccessDeniedView } from '@/components/AccessDeniedView';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { UISelect } from '@/components/ui/Select';
import { useCan } from '@/hooks/useCan';
import { ACCESS_DENIED_MESSAGE, extractErrorMessage } from '@/lib/errorMessage';
import styles from './clients.module.css';

type Client = {
  id: string;
  code?: number | null;
  type: string;
  name: string;
  relacoesComerciais?: Array<'CLIENTE' | 'FUNCIONARIO'>;
  cpf: string | null;
  cnpj: string | null;
  rg: string | null;
  inscricaoEstadual: string | null;
  cidade: string | null;
  uf: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
};

function formatType(t: string) {
  if (t === 'PF') return 'Pessoa Física';
  if (t === 'PJ') return 'Pessoa Jurídica';
  return t;
}

function formatRelacoes(v?: Array<'CLIENTE' | 'FUNCIONARIO'> | null) {
  const arr = Array.isArray(v) ? v : [];
  if (!arr.length) return '-';
  return arr
    .map((item) => (item === 'CLIENTE' ? 'Cliente' : item === 'FUNCIONARIO' ? 'Funcionário' : item))
    .join(', ');
}

function onlyDigits(v?: string | null) {
  return (v || '').replace(/\D+/g, '');
}

function formatCpf(v?: string | null) {
  const d = onlyDigits(v).slice(0, 11);
  if (!d) return '-';
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatCnpj(v?: string | null) {
  const d = onlyDigits(v).slice(0, 14);
  if (!d) return '-';
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const { can } = useCan();
  const [type, setType] = useState<'ALL' | 'PF' | 'PJ'>('ALL');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const resp = await fetch('/api/clients', { cache: 'no-store' });
      if (!resp.ok) throw new Error(extractErrorMessage(await resp.text()));
      const data = (await resp.json()) as Client[];
      setClients(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (type !== 'ALL' && c.type !== type) return false;
      if (!q) return true;
      const doc = c.type === 'PF' ? (c.cpf || '') : (c.cnpj || '');
      const code = c.code ? String(c.code) : '';
      const hay = `${code} ${c.name} ${doc}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [clients, type, q]);

  useEffect(() => {
    setPage(1);
  }, [type, q, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);
  const startItem = filtered.length === 0 ? 0 : start + 1;
  const endItem = Math.min(start + pageSize, filtered.length);

  const counts = {
    ALL: clients.length,
    PF: clients.filter((c) => c.type === 'PF').length,
    PJ: clients.filter((c) => c.type === 'PJ').length,
  };

  async function remove(id: string) {
    setErr('');
    try {
      const resp = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error(extractErrorMessage(await resp.text()));
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  function askRemove(client: Client) {
    setDeleteTarget({ id: client.id, name: client.name });
  }

  if (err === ACCESS_DENIED_MESSAGE) {
    return <AccessDeniedView area="Pessoas" />;
  }

  return (
    <main className={`${styles.page} appPageShell appListPage`}>
      <SectionHeader
        title="Pessoas"
        description="Cadastro e informações de pessoas."
        headingAs="h1"
        className={`${styles.header} appListHeader`}
        actions={<div className={`${styles.headerActions} appListHeaderActions`}>
            <BackButton fallbackHref="/dashboard" className={styles.linkMuted} />
            {can('client.create') ? (
              <Link href="/clients/new" className={styles.primaryButton}>
                Nova pessoa
              </Link>
            ) : null}
          </div>}
      />

      <section className={`${styles.controls} appListControlsCard`}>
        <div className="appFilterTabs">
          <button className={`appFilterTab ${type === 'ALL' ? 'appFilterTabActive' : ''}`} onClick={() => setType('ALL')}>
            <span>Todos</span>
            <span className="appFilterTabCount">{counts.ALL}</span>
          </button>
          <button className={`appFilterTab ${type === 'PF' ? 'appFilterTabActive' : ''}`} onClick={() => setType('PF')}>
            <span>PF</span>
            <span className="appFilterTabCount">{counts.PF}</span>
          </button>
          <button className={`appFilterTab ${type === 'PJ' ? 'appFilterTabActive' : ''}`} onClick={() => setType('PJ')}>
            <span>PJ</span>
            <span className="appFilterTabCount">{counts.PJ}</span>
          </button>
        </div>

        <div className={`${styles.search} appListSearchWrap`}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por ID, nome ou CPF/CNPJ..."
            className={`${styles.searchInput} appListSearchInput`}
          />
        </div>
      </section>

      {err ? <div className={styles.error}>{err}</div> : null}

      <section className={`${styles.tableWrap} appDataTableWrap appListTableCard`}>
        <table className={`${styles.table} appDataTable`}>
          <thead>
            <tr>
              <th></th>
              <th>ID</th>
              <th>Nome/Razão Social</th>
              <th>Tipo</th>
              <th>Relações comerciais</th>
              <th>CPF/CNPJ</th>
              <th>RG</th>
              <th>Inscrição Estadual</th>
              <th>Cidade</th>
              <th>UF</th>
              <th>Telefone</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className={`${styles.empty} appDataTableEmpty`}>Carregando...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className={`${styles.empty} appDataTableEmpty`}>
                  Nenhuma pessoa encontrada.
                </td>
              </tr>
            ) : (
              pageItems.map((c) => (
                <tr key={c.id}>
                  <td>
                    <ActionMenu triggerAriaLabel="Ações da pessoa">
                      {({ close }) => (
                        <>
                          {can('client.edit') ? (
                            <Link
                              href={`/clients/${encodeURIComponent(c.id)}/edit`}
                              className={styles.menuItem}
                              onClick={close}
                            >
                              <span className={styles.menuIcon}>✎</span>
                              Alterar
                            </Link>
                          ) : null}
                          <Link
                            href={`/clients/${encodeURIComponent(c.id)}`}
                            className={styles.menuItem}
                            onClick={close}
                          >
                            <span className={styles.menuIcon}>👁</span>
                            Visualizar
                          </Link>
                          {can('client.delete') ? (
                            <button
                              className={`${styles.menuItem} ${styles.menuDanger}`}
                              onClick={() => {
                                close();
                                askRemove(c);
                              }}
                            >
                              <span className={styles.menuIcon}>🗑</span>
                              Excluir
                            </button>
                          ) : null}
                        </>
                      )}
                    </ActionMenu>
                  </td>
                  <td className={styles.cellId} title={c.id}>{c.code ?? '-'}</td>
                  <td className={styles.cellTitle}>{c.name}</td>
                  <td>{formatType(c.type)}</td>
                  <td>{formatRelacoes(c.relacoesComerciais)}</td>
                  <td>{c.type === 'PF' ? formatCpf(c.cpf) : formatCnpj(c.cnpj)}</td>
                  <td className={styles.cellRg}>{c.type === 'PF' ? (c.rg || '-') : '-'}</td>
                  <td className={styles.cellIe}>{c.type === 'PJ' ? (c.inscricaoEstadual || '-') : '-'}</td>
                  <td className={styles.cellCidade}>{c.cidade || '-'}</td>
                  <td className={styles.cellUf}>{c.uf || '-'}</td>
                  <td className={styles.cellPhone}>{c.phone || '-'}</td>
                  <td className={styles.cellEmail}>{c.email || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <div className={`${styles.paginationRow} appListPaginationCard`}>
        <div className={`${styles.paginationInfo} appListPaginationInfo`}>
          Exibindo {startItem}-{endItem} de {filtered.length}
        </div>
        <div className={`${styles.paginationControls} appListPaginationControls`}>
          <label className={`${styles.paginationLabel} appListPaginationLabel`}>
            Itens:
            <UISelect
              value={String(pageSize)}
              onChange={(value) => setPageSize(Number(value))}
              className={`${styles.paginationSelect} appListPaginationSelect`}
              ariaLabel="Itens por página"
              options={[
                { value: '10', label: '10' },
                { value: '20', label: '20' },
                { value: '50', label: '50' },
              ]}
            />
          </label>
          <button
            type="button"
            className={`${styles.paginationButton} appListPaginationButton`}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Anterior
          </button>
          <span className={`${styles.pageNumber} appListPageNumber`}>Página {currentPage} de {totalPages}</span>
          <button
            type="button"
            className={`${styles.paginationButton} appListPaginationButton`}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Próxima
          </button>
        </div>
      </div>

      {deleteTarget ? (
        <div
          className={styles.modalOverlay}
          onClick={() => setDeleteTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
        >
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalBody}>
              <h3 id="delete-title" className={styles.modalTitle}>Excluir pessoa</h3>
              <div className={styles.modalSubtitle}>Essa ação é permanente e não pode ser desfeita.</div>
              <div className={styles.modalHint}>
                Confirma excluir a pessoa <b>{deleteTarget.name}</b>?
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={() => setDeleteTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.modalConfirm}
                onClick={async () => {
                  const target = deleteTarget;
                  setDeleteTarget(null);
                  if (!target) return;
                  await remove(target.id);
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
