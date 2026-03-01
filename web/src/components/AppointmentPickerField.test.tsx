import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import AppointmentPickerField from './AppointmentPickerField';

type Option = { id: string; label: string };

function Harness({
  options,
  onSelect,
  onClear,
}: {
  options: Option[];
  onSelect: (option: Option) => void;
  onClear?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  return (
    <AppointmentPickerField
      label="Cliente"
      query={query}
      onQueryChange={setQuery}
      placeholder="Buscar"
      isOpen={open}
      onOpenChange={setOpen}
      options={options}
      getOptionKey={(option) => option.id}
      renderOption={(option) => <span>{option.label}</span>}
      onSelect={onSelect}
      clearOptionLabel={onClear ? 'Limpar' : undefined}
      onClearSelection={onClear}
    />
  );
}

describe('AppointmentPickerField', () => {
  it('abre ao digitar e seleciona item com teclado', () => {
    const onSelect = vi.fn();

    render(
      <Harness
        options={[
          { id: '1', label: 'Ana' },
          { id: '2', label: 'Bruno' },
        ]}
        onSelect={onSelect}
        onClear={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText('Buscar');
    fireEvent.change(input, { target: { value: 'a' } });

    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ id: '1', label: 'Ana' });
  });

  it('executa limpeza quando a opção de limpar é escolhida via teclado', () => {
    const onSelect = vi.fn();
    const onClear = vi.fn();

    render(
      <Harness
        options={[{ id: '1', label: 'Ana' }]}
        onSelect={onSelect}
        onClear={onClear}
      />,
    );

    const input = screen.getByPlaceholderText('Buscar');
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
