import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UISelect } from './Select';

const OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Ativos' },
  { value: 'inactive', label: 'Inativos', disabled: true },
];

describe('UISelect', () => {
  it('abre o menu e seleciona uma opção por clique', async () => {
    const onChange = vi.fn();

    render(<UISelect options={OPTIONS} value="all" onChange={onChange} ariaLabel="Status" />);

    fireEvent.click(screen.getByRole('button', { name: 'Status' }));

    const listbox = await screen.findByRole('listbox', { name: 'Status' });
    expect(listbox).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: 'Ativos' }));

    expect(onChange).toHaveBeenCalledWith('active');
    await waitFor(() => {
      expect(screen.queryByRole('listbox', { name: 'Status' })).not.toBeInTheDocument();
    });
  });

  it('navega por teclado e ignora opção desabilitada', async () => {
    const onChange = vi.fn();

    render(<UISelect options={OPTIONS} value="all" onChange={onChange} ariaLabel="Status" />);

    const trigger = screen.getByRole('button', { name: 'Status' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }); // abre + seleciona atual

    await screen.findByRole('listbox', { name: 'Status' });

    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Status' }), { key: 'ArrowDown' }); // Ativos
    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Status' }), { key: 'ArrowDown' }); // pula Inativos(disabled) -> Todos
    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Status' }), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('não abre quando loading=true e mostra loadingLabel', () => {
    render(
      <UISelect
        options={OPTIONS}
        value="all"
        ariaLabel="Status"
        loading
        loadingLabel="Carregando status..."
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Status' });
    expect(trigger).toBeDisabled();
    expect(screen.getByText('Carregando status...')).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renderiza hidden input com name/required para submit de formulário', () => {
    render(
      <form>
        <UISelect
          options={OPTIONS}
          defaultValue="active"
          name="status"
          required
          ariaLabel="Status"
        />
      </form>,
    );

    const hidden = document.querySelector('input[type="hidden"][name="status"]') as HTMLInputElement | null;
    expect(hidden).not.toBeNull();
    expect(hidden?.value).toBe('active');
    expect(hidden?.required).toBe(true);
  });
});
