'use client';

import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '../cn';

/**
 * Figma UI/Tabs + UI/Tab (4:71205 seçili, 4:71212 seçili değil): alt kenarlıklı sıra; seçili sekmede 2 px birincil
 * renk alt çizgi. Ayarlarda bir değer seçtirdiği için erişilebilirlikte radyo grubu olarak sunulur.
 */
export function TabChoice<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="flex w-full gap-1 border-b border-border" disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              'flex min-h-11 cursor-pointer flex-col p-3 text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary',
              selected ? 'border-b-2 border-primary text-primary' : 'text-text-secondary',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </fieldset>
  );
}

/**
 * Figma UI/ThemePreview (4:67754): 10 px köşe, 12 px iç boşluk; seçiliyken 2 px birincil kenarlık.
 * Önizleme alanı ilgili temanın token'larıyla çizilir (`data-theme` alt ağaçta da geçerlidir).
 */
export function ThemeChoice<T extends 'light' | 'dark' | 'system'>({
  label,
  value,
  options,
  preview,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  preview: ReactNode;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="flex w-full flex-col gap-3 md:flex-row" disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={cn(
              'flex min-w-0 flex-1 cursor-pointer flex-col gap-3 rounded-md p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
              selected ? 'border-2 border-primary' : 'border border-border',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <div
              data-theme={option.value}
              aria-hidden="true"
              className="flex min-h-[104px] w-full flex-col rounded-sm bg-page p-3 text-xs whitespace-pre-wrap text-text"
            >
              {preview}
            </div>
            <span className={cn('text-sm', selected ? 'text-primary' : 'text-text')}>
              <span aria-hidden="true">{selected ? '◉ ' : '○ '}</span>
              {option.label}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

/** Figma UI/Input/Normal (4:67778) görünümünde seçim kutusu: "Türkçe  ▾". */
export function Select({
  label,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={id} className="text-sm text-text-secondary">
        {label}
      </label>
      <div className="relative w-full">
        <select
          id={id}
          className={cn(
            'min-h-11 w-full appearance-none rounded-sm border border-border bg-page p-3 pr-8 text-base text-text',
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-base text-text"
        >
          ▾
        </span>
      </div>
    </div>
  );
}
