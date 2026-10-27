import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

/** Figma UI/Button (4:70594 Primary, 4:70601 Secondary, 4:70608 Ghost, 4:70615 Danger, 4:70847 ikonlu). */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary',
  secondary: 'bg-surface-muted border border-border text-text',
  ghost: 'text-text',
  danger: 'bg-danger text-on-primary',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
};

export function Button({
  variant = 'secondary',
  icon,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-base font-medium whitespace-nowrap',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
