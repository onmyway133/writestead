import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "./api";

// Loads a GET endpoint and keeps the last good data while reloading, so screens don't flash.
export function useApi<T>(path: string | null): {
    data: T | undefined;
    error: string | null;
    loading: boolean;
    reload: () => Promise<void>;
    setData: (data: T) => void;
}
{
    const [data, setData] = useState<T | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(path !== null);
    const latest = useRef(path);
    latest.current = path;

    const reload = useCallback(async () =>
    {
        if (path === null)
        {
            return;
        }
        setLoading(true);
        try
        {
            const result = await api<T>(path);
            if (latest.current === path)
            {
                setData(result);
                setError(null);
            }
        }
        catch (caught)
        {
            if (latest.current === path)
            {
                setError(errorMessage(caught));
            }
        }
        finally
        {
            if (latest.current === path)
            {
                setLoading(false);
            }
        }
    }, [path]);

    useEffect(() =>
    {
        void reload();
    }, [reload]);

    return { data, error, loading, reload, setData };
}
