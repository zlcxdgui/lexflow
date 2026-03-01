'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import styles from '../ClientForm.module.css';

type Client = {
  id: string;
  code?: number | null;
  type: string;
  name: string;
  cpf: string | null;
  rg: string | null;
  cnpj: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  contribuinte: string | null;
  inscricaoEstadual: string | null;
  ufInscricaoEstadual: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  relacoesComerciais?: Array<'CLIENTE' | 'FUNCIONARIO'>;
};

function formatType(t: string) {
  if (t === 'PF') return 'Pessoa Física';
  if (t === 'PJ') return 'Pessoa Jurídica';
  return t;
}

function formatContribuinte(v?: string | null) {
  if (!v) return '-';
  if (v === 'NAO_CONTRIBUINTE') return 'Não contribuinte';
  if (v === 'CONTRIBUINTE_ICMS') return 'Contribuinte ICMS';
  if (v === 'CONTRIBUINTE_ISENTO_IE') return 'Contribuinte isento de IE';
  return v;
}

function formatRelacoes(v?: Array<'CLIENTE' | 'FUNCIONARIO'> | null) {
  const arr = Array.isArray(v) ? v : [];
  if (!arr.length) return '-';
  return arr
    .map((item) => (item === 'CLIENTE' ? 'Cliente' : item === 'FUNCIONARIO' ? 'Funcionário' : item))
    .join(', ');
}

export default function ClientDetailsPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params?.id[0] : '';
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      setErr('');
      try {
        const resp = await fetch(`/api/clients/${id}`, { cache: 'no-store' });
        if (!resp.ok) throw new Error(await resp.text());
        const data = (await resp.json()) as Client;
        setClient(data);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <main className={`${styles.page} appPageShell`}>
      <SectionHeader
        title="Visualizar pessoa"
        description="Informações da pessoa."
        headingAs="h1"
        className={styles.header}
        actions={<BackButton fallbackHref="/clients" className={styles.linkMuted} />}
      />

      <section className={styles.card}>
        {loading ? (
          <div>Carregando...</div>
        ) : !client ? (
          <div>{err || 'Pessoa não encontrada.'}</div>
        ) : (
          <div className={styles.form}>
            <div className={styles.row}>
              <div className={styles.label}>
                <span>ID</span>
                <div className={styles.input}>{client.code ?? '-'}</div>
              </div>
              <div className={styles.label}>
                <span>Tipo</span>
                <div className={styles.input}>{formatType(client.type)}</div>
              </div>
              <div className={styles.label}>
                <span>Nome</span>
                <div className={styles.input}>{client.name}</div>
              </div>
              <div className={styles.label}>
                <span>Relações comerciais</span>
                <div className={styles.input}>{formatRelacoes(client.relacoesComerciais)}</div>
              </div>
            </div>
            {client.type === 'PF' ? (
              <>
                <div className={styles.row}>
                  <div className={styles.label}>
                    <span>CPF</span>
                    <div className={styles.input}>{client.cpf || '-'}</div>
                  </div>
                  <div className={styles.label}>
                    <span>RG</span>
                    <div className={styles.input}>{client.rg || '-'}</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={styles.row}>
                  <div className={styles.label}>
                    <span>CNPJ</span>
                    <div className={styles.input}>{client.cnpj || '-'}</div>
                  </div>
                  <div className={styles.label}>
                    <span>Razão social</span>
                    <div className={styles.input}>{client.razaoSocial || '-'}</div>
                  </div>
                  <div className={styles.label}>
                    <span>Nome fantasia</span>
                    <div className={styles.input}>{client.nomeFantasia || '-'}</div>
                  </div>
                </div>
                <div className={styles.row}>
                  <div className={styles.label}>
                    <span>Contribuinte</span>
                    <div className={styles.input}>{formatContribuinte(client.contribuinte)}</div>
                  </div>
                  <div className={styles.label}>
                    <span>Inscrição estadual</span>
                    <div className={styles.input}>{client.inscricaoEstadual || '-'}</div>
                  </div>
                  <div className={styles.label}>
                    <span>UF IE</span>
                    <div className={styles.input}>{client.ufInscricaoEstadual || '-'}</div>
                  </div>
                </div>
              </>
            )}
            <div className={styles.row}>
              <div className={styles.label}>
                <span>Email</span>
                <div className={styles.input}>{client.email || '-'}</div>
              </div>
              <div className={styles.label}>
                <span>Telefone</span>
                <div className={styles.input}>{client.phone || '-'}</div>
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.label}>
                <span>CEP</span>
                <div className={styles.input}>{client.cep || '-'}</div>
              </div>
              <div className={styles.label}>
                <span>Logradouro</span>
                <div className={styles.input}>{client.logradouro || '-'}</div>
              </div>
              <div className={styles.label}>
                <span>Número</span>
                <div className={styles.input}>{client.numero || '-'}</div>
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.label}>
                <span>Complemento</span>
                <div className={styles.input}>{client.complemento || '-'}</div>
              </div>
              <div className={styles.label}>
                <span>Bairro</span>
                <div className={styles.input}>{client.bairro || '-'}</div>
              </div>
              <div className={styles.label}>
                <span>Cidade</span>
                <div className={styles.input}>{client.cidade || '-'}</div>
              </div>
              <div className={styles.label}>
                <span>UF</span>
                <div className={styles.input}>{client.uf || '-'}</div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
