import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({ label, hint, error, ...input }: InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    hint?: ReactNode;
    error?: string | null;
})
{
    const id = input.id ?? input.name;
    return (
        <div>
            <label htmlFor={id} className="label">{label}</label>
            <input id={id} className="input" aria-invalid={error ? true : undefined} {...input} />
            {error
                ? <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
                : hint && <p className="muted mt-1.5 text-xs">{hint}</p>}
        </div>
    );
}

export function FormError({ message }: { message: string | null })
{
    if (!message)
    {
        return null;
    }
    return (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {message}
        </p>
    );
}
