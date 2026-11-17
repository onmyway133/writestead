import { useCallback, useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { PageSpinner } from "./components/Spinner";
import { api, SIGNED_OUT_EVENT } from "./lib/api";
import { navigate, usePath } from "./lib/router";
import { type AuthStatus, type Session, SessionContext } from "./lib/session";
import { AnalyticsScreen } from "./screens/AnalyticsScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { CommentsScreen } from "./screens/CommentsScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { EditorScreen } from "./screens/EditorScreen";
import { InviteScreen } from "./screens/InviteScreen";
import { NewslettersScreen } from "./screens/NewslettersScreen";
import { PostsScreen } from "./screens/PostsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SitePickerScreen } from "./screens/SitePickerScreen";
import { SubscribersScreen } from "./screens/SubscribersScreen";
import { TagsScreen } from "./screens/TagsScreen";
import { ThemesScreen } from "./screens/ThemesScreen";

export function App()
{
    const path = usePath();
    const [status, setStatus] = useState<AuthStatus | null>(null);
    const [me, setMe] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () =>
    {
        const next = await api<AuthStatus>("/auth/status");
        setStatus(next);
        if (next.signedIn && !next.isMarketing && !next.needsSetup)
        {
            try
            {
                setMe(await api<Session>("/admin/me"));
            }
            catch
            {
                setMe(null);
            }
        }
        else
        {
            setMe(null);
        }
        setLoading(false);
    }, []);

    useEffect(() =>
    {
        void load();
        const signedOut = () =>
        {
            setMe(null);
            void load();
        };
        window.addEventListener(SIGNED_OUT_EVENT, signedOut);
        return () =>
        {
            window.removeEventListener(SIGNED_OUT_EVENT, signedOut);
        };
    }, [load]);

    useEffect(() =>
    {
        if (me)
        {
            document.title = `${me.site.title} · Writestead`;
        }
    }, [me]);

    if (loading || !status)
    {
        return <PageSpinner />;
    }

    if (path.startsWith("/admin/invite"))
    {
        return <InviteScreen onDone={load} />;
    }

    // The root domain of the hosted version: sign up, sign in, then pick a blog.
    if (status.isMarketing)
    {
        if (status.signedIn && path !== "/signup")
        {
            return <SitePickerScreen status={status} />;
        }
        return <AuthScreen status={status} mode={path === "/signup" ? "signup" : "login"} onDone={load} />;
    }

    if (status.needsSetup)
    {
        return <AuthScreen status={status} mode="setup" onDone={load} />;
    }

    if (!me)
    {
        return <AuthScreen status={status} mode="login" onDone={load} />;
    }

    const section = path.replace(/^\/admin\/?/, "").split("/");
    let screen;
    switch (section[0])
    {
        case "":
            screen = <DashboardScreen />;
            break;
        case "posts":
            screen = <PostsScreen type="post" />;
            break;
        case "pages":
            screen = <PostsScreen type="page" />;
            break;
        case "editor":
            return (
                <SessionContext.Provider value={{ me, reload: load }}>
                    <EditorScreen id={section[1] ?? ""} />
                </SessionContext.Provider>
            );
        case "tags":
            screen = <TagsScreen />;
            break;
        case "subscribers":
            screen = <SubscribersScreen />;
            break;
        case "newsletters":
            screen = <NewslettersScreen />;
            break;
        case "comments":
            screen = <CommentsScreen />;
            break;
        case "analytics":
            screen = <AnalyticsScreen />;
            break;
        case "themes":
            screen = <ThemesScreen />;
            break;
        case "settings":
            screen = <SettingsScreen section={section[1] ?? "general"} />;
            break;
        default:
            navigate("/admin", { replace: true });
            screen = null;
    }

    return (
        <SessionContext.Provider value={{ me, reload: load }}>
            <Layout>{screen}</Layout>
        </SessionContext.Provider>
    );
}
