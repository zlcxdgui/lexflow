'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ui.module.css';

export type UISelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

function normalizeTypeaheadText(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

type UISelectProps = {
  value?: string;
  defaultValue?: string;
  options: UISelectOption[];
  onChange?: (value: string) => void;
  name?: string;
  className?: string;
  rootClassName?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  placeholder?: string;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  required?: boolean;
};

export function UISelect({
  value,
  defaultValue,
  options,
  onChange,
  name,
  className = '',
  rootClassName = '',
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  ariaInvalid = false,
  placeholder,
  loading = false,
  loadingLabel = 'Carregando...',
  disabled = false,
  required = false,
}: UISelectProps) {
  const selectId = useId();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ left: 12, top: 12, width: 220 });
  const [uncontrolledValue, setUncontrolledValue] = useState<string>(
    defaultValue ?? value ?? options[0]?.value ?? '',
  );
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const typeaheadRef = useRef('');
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentValue = value ?? uncontrolledValue;
  const enabledIndices = useMemo(
    () => options.map((option, index) => ({ option, index })).filter(({ option }) => !option.disabled).map(({ index }) => index),
    [options],
  );
  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === currentValue),
    [options, currentValue],
  );

  const selected = useMemo(
    () => options.find((option) => option.value === currentValue) ?? options[0],
    [options, currentValue],
  );
  const triggerDisabled = disabled || loading;
  const hasSelectedMatch = selectedIndex >= 0;
  const triggerText = loading
    ? loadingLabel
    : hasSelectedMatch
      ? (selected?.label ?? '')
      : (placeholder ?? '');

  function commitValue(nextValue: string) {
    if (value === undefined) setUncontrolledValue(nextValue);
    onChange?.(nextValue);
  }

  function firstEnabledIndex() {
    return enabledIndices[0] ?? -1;
  }

  function lastEnabledIndex() {
    return enabledIndices[enabledIndices.length - 1] ?? -1;
  }

  function moveHighlight(direction: 1 | -1) {
    if (!enabledIndices.length) return;
    const current = highlightedIndex >= 0 ? highlightedIndex : (selectedIndex >= 0 ? selectedIndex : firstEnabledIndex());
    const pos = enabledIndices.indexOf(current);
    const basePos = pos >= 0 ? pos : 0;
    const nextPos = (basePos + direction + enabledIndices.length) % enabledIndices.length;
    setHighlightedIndex(enabledIndices[nextPos] ?? current);
  }

  function moveHighlightByPage(direction: 1 | -1) {
    if (!enabledIndices.length) return;
    const current = highlightedIndex >= 0 ? highlightedIndex : (selectedIndex >= 0 ? selectedIndex : firstEnabledIndex());
    const currentPos = Math.max(0, enabledIndices.indexOf(current));
    const nextPos = Math.max(0, Math.min(enabledIndices.length - 1, currentPos + direction * 8));
    setHighlightedIndex(enabledIndices[nextPos] ?? current);
  }

  function typeaheadJump(char: string) {
    const nextBuffer = normalizeTypeaheadText(`${typeaheadRef.current}${char}`);
    typeaheadRef.current = nextBuffer;
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    typeaheadTimerRef.current = setTimeout(() => {
      typeaheadRef.current = '';
      typeaheadTimerRef.current = null;
    }, 500);

    const startIndex = highlightedIndex >= 0 ? highlightedIndex : selectedIndex;
    const candidates = options
      .map((option, index) => ({ option, index }))
      .filter(({ option }) => !option.disabled);
    if (!candidates.length) return;
    const ordered = startIndex >= 0
      ? [
          ...candidates.filter(({ index }) => index > startIndex),
          ...candidates.filter(({ index }) => index <= startIndex),
        ]
      : candidates;
    const match = ordered.find(({ option }) =>
      normalizeTypeaheadText(option.label).startsWith(nextBuffer),
    );
    if (match) setHighlightedIndex(match.index);
  }

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const placeMenu = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;

      const r = trigger.getBoundingClientRect();
      const menuW = Math.max(menu.offsetWidth || 220, r.width);
      const menuH = menu.offsetHeight || 180;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pad = 8;

      let left = r.left;
      if (left + menuW > vw - pad) left = Math.max(pad, vw - pad - menuW);
      if (left < pad) left = pad;

      let top = r.bottom + 4;
      if (top + menuH > vh - pad) {
        const upTop = r.top - menuH - 4;
        top = upTop > pad ? upTop : Math.max(pad, vh - pad - menuH);
      }

      setMenuPos({ left, top, width: Math.max(r.width, 180) });
    };

    placeMenu();
    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    return () => {
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || highlightedIndex < 0) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, highlightedIndex]);

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (triggerDisabled) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex(selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : firstEnabledIndex());
      setOpen(true);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex(selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : lastEnabledIndex());
      setOpen(true);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen((prev) => !prev);
      return;
    }
    if (event.key.length === 1 && /\S/.test(event.key)) {
      typeaheadJump(event.key);
      const idx = highlightedIndex >= 0 ? highlightedIndex : selectedIndex;
      if (idx >= 0 && options[idx] && !open) {
        commitValue(options[idx].value);
      }
    }
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveHighlight(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveHighlight(-1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setHighlightedIndex(firstEnabledIndex());
      return;
    }
    if (event.key === 'PageDown') {
      event.preventDefault();
      moveHighlightByPage(1);
      return;
    }
    if (event.key === 'PageUp') {
      event.preventDefault();
      moveHighlightByPage(-1);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setHighlightedIndex(lastEnabledIndex());
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (highlightedIndex < 0) return;
      const option = options[highlightedIndex];
      if (!option || option.disabled) return;
      commitValue(option.value);
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (event.key.length === 1 && /\S/.test(event.key)) {
      event.preventDefault();
      typeaheadJump(event.key);
    }
  }

  return (
    <div className={`${styles.selectRoot} ${rootClassName}`.trim()} ref={rootRef}>
      {name ? <input type="hidden" name={name} value={currentValue} disabled={triggerDisabled} required={required} /> : null}
      <button
        ref={triggerRef}
        type="button"
        className={`${className} ${styles.selectTrigger}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-controls={open ? `${selectId}-listbox` : undefined}
        aria-activedescendant={open && highlightedIndex >= 0 ? `${selectId}-option-${highlightedIndex}` : undefined}
        data-invalid={ariaInvalid ? 'true' : undefined}
        data-required={required ? 'true' : undefined}
        data-placeholder={!loading && !hasSelectedMatch && placeholder ? 'true' : undefined}
        data-loading={loading ? 'true' : undefined}
        disabled={triggerDisabled}
        onKeyDown={handleTriggerKeyDown}
        onClick={() => {
          if (triggerDisabled) return;
          setOpen((prev) => {
            const next = !prev;
            if (next) {
              setHighlightedIndex(
                selectedIndex >= 0 && !options[selectedIndex]?.disabled
                  ? selectedIndex
                  : firstEnabledIndex(),
              );
            }
            return next;
          });
        }}
      >
        <span className={styles.selectTriggerText}>{triggerText}</span>
        <span className={`${styles.selectChevron} ${open ? styles.selectChevronOpen : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && !loading && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              id={`${selectId}-listbox`}
              className={styles.selectMenu}
              role="listbox"
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              tabIndex={-1}
              aria-activedescendant={highlightedIndex >= 0 ? `${selectId}-option-${highlightedIndex}` : undefined}
              style={{ left: menuPos.left, top: menuPos.top, minWidth: menuPos.width }}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={handleMenuKeyDown}
            >
              {options.map((option) => {
                const active = option.value === currentValue;
                const highlighted = highlightedIndex >= 0 && highlightedIndex === options.indexOf(option);
                return (
                  <button
                    ref={(el) => {
                      optionRefs.current[options.indexOf(option)] = el;
                    }}
                    id={`${selectId}-option-${options.indexOf(option)}`}
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={option.disabled}
                    className={[
                      styles.selectOption,
                      highlighted ? styles.selectOptionHighlighted : '',
                      active ? styles.selectOptionActive : '',
                      option.disabled ? styles.selectOptionDisabled : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      if (option.disabled) return;
                      commitValue(option.value);
                      setOpen(false);
                      triggerRef.current?.focus();
                    }}
                    onMouseEnter={() => {
                      if (!option.disabled) setHighlightedIndex(options.indexOf(option));
                    }}
                  >
                    <span>{option.label}</span>
                    {active ? <span className={styles.selectOptionCheck} aria-hidden="true">✓</span> : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
