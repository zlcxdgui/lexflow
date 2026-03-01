export class CreateMatterDto {
  clientId?: string | null;
  title: string;
  area?: string;
  subject?: string;
  court?: string;
  caseNumber?: string;
  status?: 'OPEN' | 'CLOSED';
}
