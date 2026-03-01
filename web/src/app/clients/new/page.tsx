import ClientForm from '@/components/ClientForm';
import { apiGet } from '@/lib/serverApi';
import { can } from '@/lib/permissions';

export default async function NewClientPage() {
  const me = await apiGet<{ role?: string }>('/me').catch(() => ({ role: '' }));
  if (!can(me.role, 'client.create')) {
    return <main className="appPageShell">Você não tem permissão para criar pessoa.</main>;
  }
  return (
    <ClientForm
      mode="new"
      title="Nova pessoa"
      subtitle="Cadastre uma nova pessoa."
      backHref="/clients"
      submitLabel="Criar pessoa"
      initial={{
        type: 'PF',
        name: '',
        relacoesComerciais: ['CLIENTE'],
        cpf: '',
        rg: '',
        cnpj: '',
        razaoSocial: '',
        nomeFantasia: '',
        contribuinte: 'NAO_CONTRIBUINTE',
        inscricaoEstadual: '',
        ufInscricaoEstadual: '',
        email: '',
        phone: '',
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        uf: '',
      }}
    />
  );
}
