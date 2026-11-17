import { useEffect, useState } from "react";
import { Dialog } from "./Dialog";

type Request = {
    title: string;
    message: string;
    confirmLabel: string;
    destructive: boolean;
    resolve: (ok: boolean) => void;
};

const EVENT = "writestead:confirm";

// Asks in the app's own dialog instead of window.confirm, so it matches the UI and the theme.
export function confirm(options: { title: string; message: string; confirmLabel?: string; destructive?: boolean }): Promise<boolean>
{
    return new Promise((resolve) =>
    {
        window.dispatchEvent(new CustomEvent<Request>(EVENT, {
            detail: { confirmLabel: "Confirm", destructive: false, ...options, resolve },
        }));
    });
}

export function ConfirmDialogHost()
{
    const [request, setRequest] = useState<Request | null>(null);

    useEffect(() =>
    {
        const show = (event: Event) =>
        {
            setRequest((event as CustomEvent<Request>).detail);
        };
        window.addEventListener(EVENT, show);
        return () =>
        {
            window.removeEventListener(EVENT, show);
        };
    }, []);

    function finish(ok: boolean)
    {
        request?.resolve(ok);
        setRequest(null);
    }

    return (
        <Dialog
            open={request !== null}
            onClose={() =>
            {
                finish(false);
            }}
            title={request?.title ?? ""}
            description={request?.message}
            footer={
                <>
                    <button type="button" className="btn-secondary" onClick={() =>
                    {
                        finish(false);
                    }}>Cancel</button>
                    <button type="button" className={request?.destructive ? "btn-danger" : "btn-primary"} onClick={() =>
                    {
                        finish(true);
                    }}>{request?.confirmLabel}</button>
                </>
            }
        />
    );
}
