import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardQuickAppointmentCard from './DashboardQuickAppointmentCard';

const appointmentTaskFormHookMock = vi.fn();

vi.mock('./useAppointmentTaskForm', () => ({
  default: (options: unknown) => appointmentTaskFormHookMock(options),
}));

function makeHookState(overrides: Record<string, unknown> = {}) {
  return {
    loading: false,
    dataError: '',
    submitting: false,
    submitError: '',
    clientSuggestions: [],
    matterSuggestions: [],
    responsibleSuggestions: [],
    clientQuery: '',
    matterQuery: '',
    responsibleQuery: '',
    openPicker: null,
    date: '2026-02-25',
    time: '09:00',
    notes: '',
    setClientQuery: vi.fn(),
    setMatterQuery: vi.fn(),
    setResponsibleQuery: vi.fn(),
    setOpenPicker: vi.fn(),
    setDate: vi.fn(),
    setTime: vi.fn(),
    setNotes: vi.fn(),
    clearClientSelection: vi.fn(),
    clearMatterSelection: vi.fn(),
    selectClient: vi.fn(),
    selectMatter: vi.fn(),
    selectResponsible: vi.fn(),
    submit: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('DashboardQuickAppointmentCard', () => {
  beforeEach(() => {
    appointmentTaskFormHookMock.mockReset();
  });

  it('abre o card e exibe erro vindo do hook', () => {
    appointmentTaskFormHookMock.mockReturnValue(
      makeHookState({ submitError: 'Selecione o responsável.' }),
    );

    render(<DashboardQuickAppointmentCard />);

    fireEvent.click(screen.getByRole('button', { name: /novo atendimento/i }));

    expect(screen.getByText('Selecione o responsável.')).toBeInTheDocument();
  });

  it('mostra mensagem de sucesso após submit', async () => {
    const submitSpy = vi.fn();

    appointmentTaskFormHookMock.mockImplementation((options: { onSuccess?: () => void }) =>
      makeHookState({
        submit: vi.fn(async () => {
          submitSpy();
          options.onSuccess?.();
          return true;
        }),
      }),
    );

    render(<DashboardQuickAppointmentCard />);

    fireEvent.click(screen.getByRole('button', { name: /novo atendimento/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar à agenda' }));

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Atendimento adicionado à agenda.')).toBeInTheDocument();
    });
  });
});
