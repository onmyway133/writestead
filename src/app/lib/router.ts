import { useEffect, useState } from "react";

const NAVIGATE_EVENT = "writestead:navigate";

// replace swaps the current history entry, for redirects that shouldn't leave a step to go back to.
export function navigate(path: string, { replace = false }: { replace?: boolean } = {})
{
    if (path !== location.pathname + location.search + location.hash)
    {
        if (replace)
        {
            history.replaceState(null, "", path);
        }
        else
        {
            history.pushState(null, "", path);
        }
        window.dispatchEvent(new Event(NAVIGATE_EVENT));
    }
}

export function usePath(): string
{
    const [path, setPath] = useState(location.pathname);
    useEffect(() =>
    {
        const update = () =>
        {
            setPath(location.pathname);
        };
        window.addEventListener("popstate", update);
        window.addEventListener(NAVIGATE_EVENT, update);
        return () =>
        {
            window.removeEventListener("popstate", update);
            window.removeEventListener(NAVIGATE_EVENT, update);
        };
    }, []);
    return path;
}

// Keeps the selected range in the URL so a refresh or a shared link shows the same view.
export function useQueryParam(name: string, fallback: string): [string, (value: string) => void]
{
    const read = () =>
    {
        return new URLSearchParams(location.search).get(name) ?? fallback;
    };
    const [value, setValue] = useState(read);
    useEffect(() =>
    {
        const update = () =>
        {
            setValue(read());
        };
        window.addEventListener("popstate", update);
        return () =>
        {
            window.removeEventListener("popstate", update);
        };
    });
    function set(next: string)
    {
        const params = new URLSearchParams(location.search);
        params.set(name, next);
        history.replaceState(null, "", `${location.pathname}?${params}`);
        setValue(next);
    }
    return [value, set];
}

// Reads and writes several query parameters at once, for the dashboard filters.
export function useQueryParams<Name extends string>(names: readonly Name[]): [Partial<Record<Name, string>>, (next: Partial<Record<Name, string>>) => void]
{
    const read = () =>
    {
        const params = new URLSearchParams(location.search);
        const values: Partial<Record<Name, string>> = {};
        for (const name of names)
        {
            const value = params.get(name);
            if (value !== null)
            {
                values[name] = value;
            }
        }
        return values;
    };
    const [values, setValues] = useState(read);
    useEffect(() =>
    {
        const update = () =>
        {
            setValues(read());
        };
        window.addEventListener("popstate", update);
        return () =>
        {
            window.removeEventListener("popstate", update);
        };
    });
    function set(next: Partial<Record<Name, string>>)
    {
        const params = new URLSearchParams(location.search);
        for (const name of names)
        {
            const value = next[name];
            if (value === undefined)
            {
                params.delete(name);
            }
            else
            {
                params.set(name, value);
            }
        }
        history.pushState(null, "", `${location.pathname}?${params}`);
        setValues(next);
    }
    return [values, set];
}
