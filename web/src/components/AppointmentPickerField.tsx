'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import styles from './DashboardQuickAppointmentCard.module.css';

type AppointmentPickerFieldProps<T> = {
  label: string;
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  options: T[];
  getOptionKey: (option: T) => string;
  renderOption: (option: T) => ReactNode;
  onSelect: (option: T) => void;
  clearOptionLabel?: string;
  onClearSelection?: () => void;
  openOnFocus?: boolean;
  closeOnFocus?: boolean;
  showWhenEmpty?: boolean;
  elevateOnOpen?: boolean;
};

export default function AppointmentPickerField<T>({
  label,
  query,
  onQueryChange,
  placeholder,
  disabled,
  isOpen,
  onOpenChange,
  options,
  getOptionKey,
  renderOption,
  onSelect,
  clearOptionLabel,
  onClearSelection,
  openOnFocus = false,
  closeOnFocus = false,
  showWhenEmpty = false,
  elevateOnOpen = false,
}: AppointmentPickerFieldProps<T>) {
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hasClearOption = Boolean(clearOptionLabel && onClearSelection);
  const total = options.length + (hasClearOption ? 1 : 0);
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, total - 1));

  useEffect(() => {
    if (!isOpen) return;
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      onOpenChange(false);
    }
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isOpen, onOpenChange]);

  function openWithReset() {
    setActiveIndex(0);
    onOpenChange(true);
  }

  function close() {
    onOpenChange(false);
  }

  function handleChange(next: string) {
    onQueryChange(next);
    const shouldOpen = showWhenEmpty || next.trim().length > 0;
    if (shouldOpen) openWithReset();
    else close();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      close();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (total === 0) {
        onOpenChange(true);
        return;
      }
      if (!isOpen) openWithReset();
      setActiveIndex((prev) => Math.min(total - 1, prev + 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (total === 0) {
        onOpenChange(true);
        return;
      }
      if (!isOpen) openWithReset();
      setActiveIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (event.key === 'Enter' && isOpen) {
      event.preventDefault();
      if (total === 0) return;

      if (hasClearOption && safeActiveIndex === 0) {
        onClearSelection?.();
        close();
        return;
      }

      const optionIndex = safeActiveIndex - (hasClearOption ? 1 : 0);
      const item = options[optionIndex];
      if (!item) return;
      onSelect(item);
      close();
    }
  }

  return (
    <div
      className={`${styles.field} ${
        elevateOnOpen && isOpen ? styles.fieldOverlay : ''
      }`.trim()}
    >
      <span>{label}</span>
      <div ref={rootRef} className={styles.personWrap} data-person-picker="true">
        <input
          className={styles.personInput}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (disabled) return;
            if (openOnFocus) {
              openWithReset();
              return;
            }
            if (closeOnFocus) {
              close();
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
        />

        {isOpen ? (
          <div className={styles.personDropdown} data-person-picker="true" role="listbox">
            {hasClearOption ? (
              <button
                type="button"
                className={`${styles.personOption} ${
                  safeActiveIndex === 0 ? styles.personOptionActive : ''
                }`.trim()}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(0)}
                onClick={() => {
                  onClearSelection?.();
                  close();
                }}
              >
                <span>{clearOptionLabel}</span>
              </button>
            ) : null}

            {options.map((option, index) => {
              const visualIndex = index + (hasClearOption ? 1 : 0);
              return (
                <button
                  key={getOptionKey(option)}
                  type="button"
                  className={`${styles.personOption} ${
                    safeActiveIndex === visualIndex ? styles.personOptionActive : ''
                  }`.trim()}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(visualIndex)}
                  onClick={() => {
                    onSelect(option);
                    close();
                  }}
                >
                  {renderOption(option)}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
