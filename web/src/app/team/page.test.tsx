import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TeamPage from './page';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: vi.fn(),
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href ?? '#')} {...props}>
      {children}
    </a>
  ),
}));

function jsonResponse(data: unknown, init?: { ok?: boolean; status?: number }) {
  const ok = init?.ok ?? true;
  const status = init?.status ?? (ok ? 200 : 500);
  return {
    ok,
    status,
    json: async () => data,
    text: async () => '',
  } as Response;
}

function makeMember({
  id,
  code,
  name,
  email,
  role = 'LAWYER',
  isActive,
}: {
  id: string;
  code: number;
  name: string;
  email: string;
  role?: 'OWNER' | 'LAWYER' | 'ASSISTANT';
  isActive: boolean;
}) {
  return {
    id,
    code,
    role,
    isActive,
    isTemporarilyLocked: false,
    permissions: {
      isSelf: false,
      isLastActiveOwner: false,
      canChangeRole: true,
      canDeactivate: true,
    },
    user: { id: `${id}-user`, name, email },
  };
}

describe('TeamPage integration with UISelect', () => {
  function setupTeamFetch() {
    return vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/auth/me') {
        return jsonResponse({
          sub: 'me-user',
          tenantId: 'tenant-1',
          role: 'ADMIN',
          email: 'admin@example.com',
          permissions: ['team.update'],
        });
      }
      if (url === '/api/tenants/mine') {
        return jsonResponse([{ tenantId: 'tenant-1' }]);
      }
      if (url === '/api/tenants/tenant-1/members') {
        return jsonResponse([
          makeMember({
            id: 'm1',
            code: 1,
            name: 'Alice Ativa',
            email: 'alice@example.com',
            isActive: true,
          }),
          makeMember({
            id: 'm2',
            code: 2,
            name: 'Igor Inativo',
            email: 'igor@example.com',
            isActive: false,
          }),
        ]);
      }
      if (url === '/api/tenants/tenant-1/invites/pending') {
        return jsonResponse([]);
      }
      if (url === '/api/tenants/tenant-1/access-groups') {
        return jsonResponse([]);
      }
      return jsonResponse([], { ok: false, status: 404 });
    });
  }

  function setupTeamFetchManyMembers() {
    const members = Array.from({ length: 12 }, (_, index) =>
      makeMember({
        id: `m${index + 1}`,
        code: index + 1,
        name: `Membro ${index + 1}`,
        email: `membro${index + 1}@example.com`,
        isActive: true,
      }),
    );

    return vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/auth/me') {
        return jsonResponse({
          sub: 'me-user',
          tenantId: 'tenant-1',
          role: 'ADMIN',
          email: 'admin@example.com',
          permissions: ['team.update'],
        });
      }
      if (url === '/api/tenants/mine') {
        return jsonResponse([{ tenantId: 'tenant-1' }]);
      }
      if (url === '/api/tenants/tenant-1/members') {
        return jsonResponse(members);
      }
      if (url === '/api/tenants/tenant-1/invites/pending') {
        return jsonResponse([]);
      }
      if (url === '/api/tenants/tenant-1/access-groups') {
        return jsonResponse([]);
      }
      return jsonResponse([], { ok: false, status: 404 });
    });
  }

  function setupTeamFetchMixedFilters() {
    return vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/auth/me') {
        return jsonResponse({
          sub: 'me-user',
          tenantId: 'tenant-1',
          role: 'ADMIN',
          email: 'admin@example.com',
          permissions: ['team.update'],
        });
      }
      if (url === '/api/tenants/mine') {
        return jsonResponse([{ tenantId: 'tenant-1' }]);
      }
      if (url === '/api/tenants/tenant-1/members') {
        return jsonResponse([
          makeMember({
            id: 'm1',
            code: 1,
            name: 'Ana Sócia Ativa',
            email: 'ana@example.com',
            role: 'OWNER',
            isActive: true,
          }),
          makeMember({
            id: 'm2',
            code: 2,
            name: 'Bruno Advogado Ativo',
            email: 'bruno@example.com',
            role: 'LAWYER',
            isActive: true,
          }),
          makeMember({
            id: 'm3',
            code: 3,
            name: 'Carla Advogada Inativa',
            email: 'carla@example.com',
            role: 'LAWYER',
            isActive: false,
          }),
          makeMember({
            id: 'm4',
            code: 4,
            name: 'Davi Assistente Inativo',
            email: 'davi@example.com',
            role: 'ASSISTANT',
            isActive: false,
          }),
        ]);
      }
      if (url === '/api/tenants/tenant-1/invites/pending') {
        return jsonResponse([]);
      }
      if (url === '/api/tenants/tenant-1/access-groups') {
        return jsonResponse([]);
      }
      return jsonResponse([], { ok: false, status: 404 });
    });
  }

  beforeEach(() => {
    pushMock.mockReset();
    vi.restoreAllMocks();
  });

  it('filtra membros por status usando UISelect', async () => {
    const fetchMock = setupTeamFetch();

    render(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Ativa')).toBeInTheDocument();
      expect(screen.getByText('Igor Inativo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Filtro por status' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Inativos' }));

    await waitFor(() => {
      expect(screen.queryByText('Alice Ativa')).not.toBeInTheDocument();
      expect(screen.getByText('Igor Inativo')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('altera itens por página usando UISelect de paginação', async () => {
    setupTeamFetchManyMembers();

    render(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByText('Membro 1')).toBeInTheDocument();
      expect(screen.getByText('Membro 10')).toBeInTheDocument();
    });

    expect(screen.queryByText('Membro 11')).not.toBeInTheDocument();
    expect(screen.getByText(/Exibindo 1-10 de 12/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Itens por página' }));
    fireEvent.click(await screen.findByRole('option', { name: '25' }));

    await waitFor(() => {
      expect(screen.getByText('Membro 11')).toBeInTheDocument();
      expect(screen.getByText('Membro 12')).toBeInTheDocument();
      expect(screen.getByText(/Exibindo 1-12 de 12/)).toBeInTheDocument();
    });
  });

  it('combina filtros de status e cargo usando UISelect', async () => {
    setupTeamFetchMixedFilters();

    render(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByText('Ana Sócia Ativa')).toBeInTheDocument();
      expect(screen.getByText('Bruno Advogado Ativo')).toBeInTheDocument();
      expect(screen.getByText('Carla Advogada Inativa')).toBeInTheDocument();
      expect(screen.getByText('Davi Assistente Inativo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Filtro por status' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Inativos' }));

    await waitFor(() => {
      expect(screen.queryByText('Ana Sócia Ativa')).not.toBeInTheDocument();
      expect(screen.queryByText('Bruno Advogado Ativo')).not.toBeInTheDocument();
      expect(screen.getByText('Carla Advogada Inativa')).toBeInTheDocument();
      expect(screen.getByText('Davi Assistente Inativo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Filtro por cargo' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Advogado' }));

    await waitFor(() => {
      expect(screen.getByText('Carla Advogada Inativa')).toBeInTheDocument();
      expect(screen.queryByText('Davi Assistente Inativo')).not.toBeInTheDocument();
      expect(screen.queryByText('Ana Sócia Ativa')).not.toBeInTheDocument();
      expect(screen.queryByText('Bruno Advogado Ativo')).not.toBeInTheDocument();
    });
  });

  it('altera agrupamento usando UISelect e exibe cabeçalhos de grupo', async () => {
    setupTeamFetchMixedFilters();

    render(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByText('Ana Sócia Ativa')).toBeInTheDocument();
      expect(screen.getByText('Carla Advogada Inativa')).toBeInTheDocument();
    });

    expect(screen.queryByText('Grupo: Ativos')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Agrupamento' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Agrupar por status' }));

    await waitFor(() => {
      expect(screen.getByText('Grupo: Ativos')).toBeInTheDocument();
      expect(screen.getByText('Grupo: Inativos')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Agrupamento' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Agrupar por cargo' }));

    await waitFor(() => {
      expect(screen.getByText('Grupo: Sócio')).toBeInTheDocument();
      expect(screen.getByText('Grupo: Advogado')).toBeInTheDocument();
      expect(screen.getByText('Grupo: Assistente')).toBeInTheDocument();
    });
  });

  it('altera ordenação pelos cabeçalhos da tabela', async () => {
    setupTeamFetchMixedFilters();

    render(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByText('Ana Sócia Ativa')).toBeInTheDocument();
      expect(screen.getByText('Davi Assistente Inativo')).toBeInTheDocument();
    });

    const getVisibleMemberNames = () =>
      screen
        .getAllByText(/@(example\.com)/i)
        .map((emailNode) => emailNode.closest('div')?.previousElementSibling?.textContent ?? '')
        .filter(Boolean);

    expect(getVisibleMemberNames()).toEqual([
      'Ana Sócia Ativa',
      'Bruno Advogado Ativo',
      'Carla Advogada Inativa',
      'Davi Assistente Inativo',
    ]);

    fireEvent.click(screen.getByRole('button', { name: /Usuário/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Usuário .*▲/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Usuário .*▲/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Usuário .*▼/ })).toBeInTheDocument();
    });

    expect(getVisibleMemberNames()).toEqual([
      'Davi Assistente Inativo',
      'Carla Advogada Inativa',
      'Bruno Advogado Ativo',
      'Ana Sócia Ativa',
    ]);
  });

  it('abre ActionMenu do membro e navega ao clicar em Alterar', async () => {
    setupTeamFetchMixedFilters();

    render(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByText('Ana Sócia Ativa')).toBeInTheDocument();
    });

    const memberActionButtons = screen.getAllByRole('button', { name: 'Ações do membro' });
    expect(memberActionButtons.length).toBeGreaterThan(0);

    fireEvent.click(memberActionButtons[0]);

    const alterLink = await screen.findByRole('link', { name: 'Alterar' });
    fireEvent.click(alterLink);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/team/members/m1/edit?code=1');
    });
  });

  it('confirma desativação de membro e envia PATCH', async () => {
    let membersState = [
      makeMember({
        id: 'm1',
        code: 1,
        name: 'Ana Sócia Ativa',
        email: 'ana@example.com',
        role: 'OWNER',
        isActive: true,
      }),
      makeMember({
        id: 'm2',
        code: 2,
        name: 'Bruno Advogado Ativo',
        email: 'bruno@example.com',
        role: 'LAWYER',
        isActive: true,
      }),
    ];

    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === '/api/auth/me') {
        return jsonResponse({
          sub: 'me-user',
          tenantId: 'tenant-1',
          role: 'ADMIN',
          email: 'admin@example.com',
          permissions: ['team.update'],
        });
      }
      if (url === '/api/tenants/mine') {
        return jsonResponse([{ tenantId: 'tenant-1' }]);
      }
      if (url === '/api/tenants/tenant-1/members' && method === 'GET') {
        return jsonResponse(membersState);
      }
      if (url === '/api/tenants/tenant-1/invites/pending') {
        return jsonResponse([]);
      }
      if (url === '/api/tenants/tenant-1/access-groups') {
        return jsonResponse([]);
      }
      if (url === '/api/tenants/tenant-1/members/m1' && method === 'PATCH') {
        const payload = JSON.parse(String(init?.body));
        if (payload?.isActive === false) {
          membersState = membersState.map((member) =>
            member.id === 'm1' ? { ...member, isActive: false } : member,
          );
        }
        return jsonResponse({ ok: true });
      }
      return jsonResponse([], { ok: false, status: 404 });
    });

    render(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByText('Ana Sócia Ativa')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Ações do membro' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Desativar' }));

    await waitFor(() => {
      expect(screen.getByText('Desativar membro')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Desativar' })).toBeInTheDocument();
    });

    const confirmButtons = screen.getAllByRole('button', { name: 'Desativar' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Membro atualizado com sucesso.')).toBeInTheDocument();
    });

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === '/api/tenants/tenant-1/members/m1' && init?.method === 'PATCH',
    );
    expect(patchCall).toBeTruthy();
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({ isActive: false });
  });
});
