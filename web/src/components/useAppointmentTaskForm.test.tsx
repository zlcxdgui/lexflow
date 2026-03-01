import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useAppointmentTaskForm from './useAppointmentTaskForm';

const mockUseAppointmentPickerData = vi.fn();

vi.mock('./useAppointmentPickerData', () => ({
  default: () => mockUseAppointmentPickerData(),
}));

describe('useAppointmentTaskForm', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockUseAppointmentPickerData.mockReset();
    mockUseAppointmentPickerData.mockReturnValue({
      loading: false,
      error: '',
      clients: [
        { id: 'c1', name: 'Cliente 1', code: 10, cpf: '12345678901' },
      ],
      matters: [{ id: 'm1', title: 'Caso 1', status: 'OPEN', clientId: 'c1' }],
      members: [
        {
          id: 'member-1',
          user: { id: 'u1', name: 'Maria', email: 'maria@example.com' },
          isActive: true,
        },
      ],
    });
  });

  it('valida responsável antes de submeter', async () => {
    const { result } = renderHook(() =>
      useAppointmentTaskForm({
        apiBase: '/api/tasks',
        dueDateFormatter: (date, time) => `${date}T${time}:00`,
        clientSearchText: (client) => client.name,
        clientSelectedLabel: (client) => client.name,
        showSuggestionsWhenEmpty: false,
      }),
    );

    let ok = false;
    await act(async () => {
      ok = await result.current.submit();
    });

    expect(ok).toBe(false);
    expect(result.current.submitError).toBe('Selecione o responsável.');
  });

  it('envia payload e chama onSuccess', async () => {
    const onSuccess = vi.fn();
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => '',
    } as Response);

    const { result } = renderHook(() =>
      useAppointmentTaskForm({
        apiBase: '/api/tasks',
        dueDateFormatter: (date, time) => `FMT:${date}:${time}`,
        clientSearchText: (client) => `${client.code || ''} ${client.name}`,
        clientSelectedLabel: (client) => client.name,
        showSuggestionsWhenEmpty: true,
        resetOnSuccess: 'notes',
        onSuccess,
      }),
    );

    await act(async () => {
      result.current.setNotes('Observação teste');
      result.current.selectClient('c1');
      result.current.selectMatter('m1');
      result.current.selectResponsible('u1');
    });

    let ok = false;
    await act(async () => {
      ok = await result.current.submit();
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tasks',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(body).toMatchObject({
      matterId: 'm1',
      assignedToUserId: 'u1',
      priority: 'MEDIUM',
      dueDate: expect.stringContaining('FMT:'),
      title: 'Atendimento: Cliente 1',
    });
    expect(body.description).toContain('Cliente: Cliente 1');
    expect(body.description).toContain('Observação teste');

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    expect(result.current.notes).toBe('');
  });
});
