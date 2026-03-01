import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AgendaAppointmentForm from './AgendaAppointmentForm';

const appointmentTaskFormHookMock = vi.fn();
const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('./useAppointmentTaskForm', () => ({
  default: (options: unknown) => appointmentTaskFormHookMock(options),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
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

describe('AgendaAppointmentForm', () => {
  beforeEach(() => {
    appointmentTaskFormHookMock.mockReset();
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  it('renderiza erro vindo do hook', () => {
    appointmentTaskFormHookMock.mockReturnValue(
      makeHookState({ submitError: 'Selecione o responsável.' }),
    );

    render(<AgendaAppointmentForm />);

    expect(screen.getByText('Selecione o responsável.')).toBeInTheDocument();
  });

  it('submete e executa callback de sucesso (redirect + refresh)', async () => {
    const submitSpy = vi.fn().mockResolvedValue(true);

    appointmentTaskFormHookMock.mockImplementation((options: { onSuccess?: () => Promise<void> }) =>
      makeHookState({
        submit: vi.fn(async () => {
          await options.onSuccess?.();
          return submitSpy();
        }),
      }),
    );

    render(<AgendaAppointmentForm redirectTo="/dashboard" />);

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar à agenda' }));

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith('/dashboard');
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });
});
