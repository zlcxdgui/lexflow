'use client';

import { useEffect, useState } from 'react';

export type AppointmentMember = {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  isActive?: boolean;
};

export type AppointmentClient = {
  id: string;
  name: string;
  code?: number | null;
  cpf?: string | null;
  relacoesComerciais?: Array<'CLIENTE' | 'FUNCIONARIO'>;
};

export type AppointmentMatter = {
  id: string;
  title: string;
  status: string;
  clientId?: string | null;
  client?: { id: string; name: string } | null;
};

type State = {
  loading: boolean;
  error: string;
  clients: AppointmentClient[];
  matters: AppointmentMatter[];
  members: AppointmentMember[];
};

export default function useAppointmentPickerData(): State {
  const [state, setState] = useState<State>({
    loading: true,
    error: '',
    clients: [],
    matters: [],
    members: [],
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      setState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const [clientsResp, mattersResp, meResp] = await Promise.all([
          fetch('/api/clients', { cache: 'no-store' }),
          fetch('/api/matters', { cache: 'no-store' }),
          fetch('/api/auth/me', { cache: 'no-store' }),
        ]);

        if (!clientsResp.ok) throw new Error('Não foi possível carregar clientes.');
        if (!mattersResp.ok) throw new Error('Não foi possível carregar casos.');
        if (!meResp.ok) throw new Error('Não foi possível carregar sessão.');

        const clientsData = (await clientsResp.json().catch(() => [])) as AppointmentClient[];
        const mattersData = (await mattersResp.json().catch(() => [])) as AppointmentMatter[];
        const meData = (await meResp.json().catch(() => ({}))) as { tenantId?: string };

        if (!meData?.tenantId) throw new Error('Escritório não identificado.');

        const membersResp = await fetch(`/api/tenants/${meData.tenantId}/members`, {
          cache: 'no-store',
        });
        if (!membersResp.ok) throw new Error('Não foi possível carregar equipe.');
        const membersData = (await membersResp.json().catch(() => [])) as AppointmentMember[];

        if (!mounted) return;

        const clients = (Array.isArray(clientsData) ? clientsData : []).filter((c) =>
          (c.relacoesComerciais || ['CLIENTE']).includes('CLIENTE'),
        );
        const matters = (Array.isArray(mattersData) ? mattersData : []).filter(
          (m) => m.status !== 'CLOSED',
        );
        const members = (Array.isArray(membersData) ? membersData : []).filter(
          (m) => m.isActive !== false,
        );

        setState({ loading: false, error: '', clients, matters, members });
      } catch (e: unknown) {
        if (!mounted) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: e instanceof Error ? e.message : 'Falha ao carregar dados.',
        }));
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
