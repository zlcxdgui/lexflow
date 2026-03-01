export class CreateClientDto {
  type: 'PF' | 'PJ';
  name: string;
  relacoesComerciais?: Array<'CLIENTE' | 'FUNCIONARIO'>;

  cpf?: string;
  rg?: string;

  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  contribuinte?:
    | 'NAO_CONTRIBUINTE'
    | 'CONTRIBUINTE_ICMS'
    | 'CONTRIBUINTE_ISENTO_IE';
  inscricaoEstadual?: string;
  ufInscricaoEstadual?: string;

  email?: string;
  phone?: string;

  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}
