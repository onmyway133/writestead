import { X } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useRef } from "react";

// A modal built on <dialog>, which gives focus trapping, Escape to close and a backdrop for free.
export function Dialog({ open, onClose, title, description, children, footer, wide = false }: {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: ReactNode;
    children?: ReactNode;
    footer?: ReactNode;
    wide?: boolean;
})
{
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() =>
    {
        const dialog = ref.current;
        if (!dialog)
        {
            return;
        }
        if (open && !dialog.open)
        {
            dialog.showModal();
        }
        else if (!open && dialog.open)
        {
            dialog.close();
        }
    }, [open]);

    return (
        <dialog
            ref={ref}
            onCancel={(event) =>
            {
                event.preventDefault();
                onClose();
            }}
            onClick={(event) =>
            {
                if (event.target === ref.current)
                {
                    onClose();
                }
            }}
            className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl bg-white p-0 text-zinc-900 shadow-2xl ring-1 ring-zinc-900/10 backdrop:bg-zinc-950/40 backdrop:backdrop-blur-[2px] open:animate-pop-in dark:bg-zinc-900 dark:text-zinc-100 dark:ring-white/10`}
        >
            {open && (
                <div className="flex max-h-[85vh] flex-col">
                    <div className="flex items-start gap-3 px-6 pt-5">
                        <div className="min-w-0 flex-1">
                            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
                            {description && <p className="muted mt-1 text-sm">{description}</p>}
                        </div>
                        <button type="button" className="icon-btn -mr-2 -mt-1" onClick={onClose} aria-label="Close">
                            <X className="size-4" />
                        </button>
                    </div>
                    {children && <div className="overflow-y-auto px-6 py-4">{children}</div>}
                    {footer && <div className="flex justify-end gap-2 px-6 pb-5 pt-1">{footer}</div>}
                </div>
            )}
        </dialog>
    );
}
