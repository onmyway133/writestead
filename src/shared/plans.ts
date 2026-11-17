// What each plan can do. Check a named entitlement on the server, never the plan name.
// Self-hosted installs ("single" mode) get everything.

export type Plan = "free" | "pro" | "self";

export type Entitlements = {
    plan: Plan;
    subscriberLimit: number;
    monthlyEmailLimit: number;
    staffLimit: number;
    analyticsDays: number;
    canUseCustomDomain: boolean;
    canUsePremiumThemes: boolean;
    canUseCodeInjection: boolean;
    canUsePaidMembers: boolean;
    canUseApi: boolean;
    canHidePoweredBy: boolean;
    canUseAdvancedAnalytics: boolean;
};

const UNLIMITED = Number.MAX_SAFE_INTEGER;

export const PLAN_ENTITLEMENTS: Record<Plan, Entitlements> = {
    free: {
        plan: "free",
        subscriberLimit: 1000,
        monthlyEmailLimit: 10000,
        staffLimit: 2,
        analyticsDays: 30,
        canUseCustomDomain: false,
        canUsePremiumThemes: false,
        canUseCodeInjection: false,
        canUsePaidMembers: false,
        canUseApi: false,
        canHidePoweredBy: false,
        canUseAdvancedAnalytics: false,
    },
    pro: {
        plan: "pro",
        subscriberLimit: 10000,
        monthlyEmailLimit: 100000,
        staffLimit: 10,
        analyticsDays: 3650,
        canUseCustomDomain: true,
        canUsePremiumThemes: true,
        canUseCodeInjection: true,
        canUsePaidMembers: true,
        canUseApi: true,
        canHidePoweredBy: true,
        canUseAdvancedAnalytics: true,
    },
    self: {
        plan: "self",
        subscriberLimit: UNLIMITED,
        monthlyEmailLimit: UNLIMITED,
        staffLimit: UNLIMITED,
        analyticsDays: 3650,
        canUseCustomDomain: true,
        canUsePremiumThemes: true,
        canUseCodeInjection: true,
        canUsePaidMembers: true,
        canUseApi: true,
        canHidePoweredBy: true,
        canUseAdvancedAnalytics: true,
    },
};

export const PRO_PRICE = { monthly: 9, yearly: 90 };
