import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '../cn';

/** Figma UI/Input (4:70725 Normal, 4:70735 Error, 4:70745 Disabled). Etiket her zaman görünür (UI_UX §6). */
export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | undefined;
};

export function Input({ label, error, id, className, disabled, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={inputId} className="text-sm text-text-secondary">
        {label}
      </label>
      <input
        id={inputId}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'min-h-11 w-full rounded-sm border p-3 text-base',
          disabled ? 'bg-surface-muted text-text-secondary' : 'bg-page text-text',
          error ? 'border-danger' : 'border-border',
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
