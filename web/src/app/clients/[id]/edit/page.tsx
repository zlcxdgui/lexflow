'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import ClientForm from '@/components/ClientForm';
import { useCan } from '@/hooks/useCan';
import styles from '../../ClientForm.module.css';

type Client = {
  id: string;
  type: string;
  name: string;
  relacoesComerciais?: Array<'CLIENTE' | 'FUNCIONARIO'>;
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
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

export default function EditClientPage() {
  const { can, loading: loadingPerm } = useCan();
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

  if (loading || loadingPerm) {
    return (
      <main className={`${styles.page} appPageShell`}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Editar pessoa</h1>
            <div className={styles.subtitle}>Carregando dados da pessoa...</div>
          </div>
          <BackButton fallbackHref="/clients" className={styles.linkMuted} />
        </header>
        <section className={styles.card}>Carregando...</section>
      </main>
    );
  }

  if (!client) {
    return (
      <main className={`${styles.page} appPageShell`}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Pessoa não encontrada</h1>
            <div className={styles.subtitle}>
              A pessoa solicitada não existe ou não está acessível.
            </div>
          </div>
          <BackButton fallbackHref="/clients" className={styles.linkMuted} />
        </header>
        <section className={styles.card}>
          {err || 'Não foi possível carregar a pessoa.'}
        </section>
      </main>
    );
  }

  if (!can('client.edit')) {
    return (
      <main className={`${styles.page} appPageShell`}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Sem permissão</h1>
            <div className={styles.subtitle}>Você não tem permissão para editar pessoa.</div>
          </div>
          <BackButton fallbackHref="/clients" className={styles.linkMuted} />
        </header>
      </main>
    );
  }

  return (
      <ClientForm
        mode="edit"
        clientId={client.id}
        title="Editar pessoa"
        subtitle="Atualize as informações da pessoa."
        backHref="/clients"
        submitLabel="Salvar alterações"
        initial={{
          type: client.type,
          name: client.name,
          relacoesComerciais: client.relacoesComerciais?.length ? client.relacoesComerciais : ['CLIENTE'],
          cpf: client.cpf || '',
          rg: client.rg || '',
          cnpj: client.cnpj || '',
          razaoSocial: client.razaoSocial || '',
          nomeFantasia: client.nomeFantasia || '',
          contribuinte: client.contribuinte || 'NAO_CONTRIBUINTE',
          inscricaoEstadual: client.inscricaoEstadual || '',
          ufInscricaoEstadual: client.ufInscricaoEstadual || '',
          email: client.email || '',
          phone: client.phone || '',
          cep: client.cep || '',
          logradouro: client.logradouro || '',
          numero: client.numero || '',
          complemento: client.complemento || '',
          bairro: client.bairro || '',
          cidade: client.cidade || '',
          uf: client.uf || '',
        }}
      />
  );
}
