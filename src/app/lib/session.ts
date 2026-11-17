import { createContext, useContext } from "react";
import type { Me } from "../../shared/types";

export type Session = Me & { emailConfigured: boolean; rootDomain: string };

export type SessionContextValue = { me: Session; reload: () => Promise<void> };

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue
{
    const value = useContext(SessionContext);
    if (!value)
    {
        throw new Error("useSession outside SessionContext");
    }
    return value;
}

export type AuthStatus = {
    mode: "single" | "multi";
    needsSetup: boolean;
    isMarketing: boolean;
    siteTitle: string | null;
    isDemo: boolean;
    signedIn: boolean;
    rootDomain: string;
    turnstileSiteKey: string;
};

const RANK = { owner: 5, admin: 4, editor: 3, author: 2, contributor: 1 } as const;

export function canManageSettings(me: Session): boolean
{
    return RANK[me.role] >= RANK.admin;
}

export function canManageSubscribers(me: Session): boolean
{
    return RANK[me.role] >= RANK.editor;
}

export function canPublish(me: Session): boolean
{
    return RANK[me.role] >= RANK.author;
}
