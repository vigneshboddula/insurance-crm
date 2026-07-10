"use client";

import { useFormStatus } from "react-dom";

const fieldCls =
  "w-full rounded-xl border bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-4 focus:border-accent";
const borderStyle = { borderColor: "var(--border-2)", borderWidth: "0.5px" } as const;

export function Field({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-2">
        {label} {required && <span style={{ color: "var(--red)" }}>*</span>}
      </span>
      {children}
      {hint && <span className="mt-0.5 block text-[10px] text-ink-4">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldCls} ${props.className ?? ""}`} style={{ ...borderStyle, ...props.style }} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldCls} ${props.className ?? ""}`} style={{ ...borderStyle, ...props.style }} />;
}

export function Select({ options, placeholder, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select {...props} className={`${fieldCls} ${props.className ?? ""}`} style={{ ...borderStyle, ...props.style }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function SubmitButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`btn btn-accent ${className}`} style={{ opacity: pending ? 0.7 : 1 }}>
      {pending ? "Saving…" : children}
    </button>
  );
}
