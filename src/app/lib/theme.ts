import { useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark";

export const THEMES: Theme[] = ["system", "light", "dark"];

// The same key is read by the inline script in index.html before the app loads.
const STORAGE_KEY = "writestead-theme";
const CHANGE_EVENT = "writestead:theme";
const darkQuery = () => matchMedia("(prefers-color-scheme: dark)");

export function getTheme(): Theme
{
    try
    {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved === "system" || saved === "dark" ? saved : "light";
    }
    catch
    {
        // Storage can be blocked; light is the default look.
        return "light";
    }
}

export function setTheme(theme: Theme)
{
    try
    {
        if (theme === "light")
        {
            localStorage.removeItem(STORAGE_KEY);
        }
        else
        {
            localStorage.setItem(STORAGE_KEY, theme);
        }
    }
    catch
    {
        // Still apply it for this page view.
    }
    applyTheme(theme);
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

function applyTheme(theme: Theme)
{
    const isDark = theme === "dark" || (theme === "system" && darkQuery().matches);
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
}

// Follows OS theme changes live while the choice is System, and choices made in other tabs.
export function watchTheme(): () => void
{
    const query = darkQuery();
    const update = () =>
    {
        applyTheme(getTheme());
    };
    query.addEventListener("change", update);
    window.addEventListener("storage", update);
    return () =>
    {
        query.removeEventListener("change", update);
        window.removeEventListener("storage", update);
    };
}

export function useTheme(): [Theme, (theme: Theme) => void]
{
    const [theme, setState] = useState(getTheme);
    useEffect(() =>
    {
        const update = () =>
        {
            setState(getTheme());
        };
        window.addEventListener(CHANGE_EVENT, update);
        window.addEventListener("storage", update);
        return () =>
        {
            window.removeEventListener(CHANGE_EVENT, update);
            window.removeEventListener("storage", update);
        };
    }, []);
    return [theme, setTheme];
}
