import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error, the building block of every form. */
export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-rose-600">{error}</p> : hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ invalid, className, ...props }: InputProps) {
  return <input className={cn('input', invalid && 'input-error', className)} {...props} />;
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ invalid, className, rows = 4, ...props }: TextareaProps) {
  return <textarea rows={rows} className={cn('input resize-y', invalid && 'input-error', className)} {...props} />;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function Select({ invalid, className, children, ...props }: SelectProps) {
  return (
    <select className={cn('input pr-8', invalid && 'input-error', className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn('h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200', className)}
      {...props}
    />
  );
}
