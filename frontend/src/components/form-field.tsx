import type { ReactNode } from "react";

interface FormFieldProps {
    label: string;
    hint?: string;
    children: ReactNode;
}

export function FormField({ label, hint, children }: FormFieldProps) {
    return (
        <label className="grid gap-2 text-sm text-muted">
            <span className="label">{label}</span>
            {children}
            {hint && <span className="text-xs text-muted">{hint}</span>}
        </label>
    );
}
