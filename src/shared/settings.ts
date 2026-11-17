// Blog settings stored as JSON on the sites row. Every field has a default, so old rows keep working
// when a new setting is added.

export type NavItem = { label: string; url: string };

export type SiteSettings = {
    theme: string;
    accent: string;
    // Overrides the theme's own fonts when not empty.
    headingFont: string;
    bodyFont: string;
    logo: string;
    icon: string;
    coverImage: string;
    // Post list layout on the home page.
    layout: "list" | "grid" | "magazine";
    colorScheme: "auto" | "light" | "dark";
    showAuthor: boolean;
    showReadingTime: boolean;
    navigation: NavItem[];
    footerNavigation: NavItem[];
    social: { x: string; github: string; mastodon: string; bluesky: string; instagram: string; linkedin: string };
    customCss: string;
    headCode: string;
    footerCode: string;
    language: string;
    timezone: string;
    // Members and newsletters
    membersEnabled: boolean;
    paidEnabled: boolean;
    commentsMode: "off" | "all" | "members" | "paid";
    commentsModeration: boolean;
    welcomeEmail: { enabled: boolean; subject: string; body: string };
    subscribeTitle: string;
    subscribeText: string;
    newsletterName: string;
    newsletterFooter: string;
    // Waitlist page
    waitlistTitle: string;
    waitlistText: string;
    hidePoweredBy: boolean;
};

export const DEFAULT_SETTINGS: SiteSettings = {
    theme: "stead",
    accent: "",
    headingFont: "",
    bodyFont: "",
    logo: "",
    icon: "",
    coverImage: "",
    layout: "list",
    colorScheme: "auto",
    showAuthor: true,
    showReadingTime: true,
    navigation: [
        { label: "Home", url: "/" },
        { label: "Archive", url: "/archive" },
        { label: "About", url: "/about" },
    ],
    footerNavigation: [
        { label: "RSS", url: "/rss.xml" },
        { label: "Search", url: "/search" },
    ],
    social: { x: "", github: "", mastodon: "", bluesky: "", instagram: "", linkedin: "" },
    customCss: "",
    headCode: "",
    footerCode: "",
    language: "en",
    timezone: "UTC",
    membersEnabled: true,
    paidEnabled: false,
    commentsMode: "all",
    commentsModeration: true,
    welcomeEmail: {
        enabled: true,
        subject: "Welcome aboard",
        body: "Thanks for subscribing. New posts will land in your inbox. You can change your email preferences at any time from the link at the bottom of every email.",
    },
    subscribeTitle: "Subscribe to the newsletter",
    subscribeText: "Get new posts in your inbox. No spam, unsubscribe anytime.",
    newsletterName: "",
    newsletterFooter: "",
    waitlistTitle: "Something new is coming",
    waitlistText: "Leave your email and you'll be the first to know when we launch.",
    hidePoweredBy: false,
};

export function readSettings(json: string | null | undefined): SiteSettings
{
    let parsed: Partial<SiteSettings> = {};
    try
    {
        parsed = json ? JSON.parse(json) : {};
    }
    catch
    {
        // A broken row falls back to defaults rather than taking the blog down.
    }
    return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        social: { ...DEFAULT_SETTINGS.social, ...parsed.social },
        welcomeEmail: { ...DEFAULT_SETTINGS.welcomeEmail, ...parsed.welcomeEmail },
    };
}

export type ThemeInfo = {
    id: string;
    name: string;
    style: string;
    description: string;
    premium: boolean;
    accent: string;
    layout: SiteSettings["layout"];
    // Colors for the picker preview card.
    swatch: [string, string, string];
};

export const THEMES: ThemeInfo[] = [
    { id: "stead", name: "Stead", style: "Minimal", description: "Clean, fast and quiet. Lets the words do the work.", premium: false, accent: "#6d4aff", layout: "list", swatch: ["#ffffff", "#18162b", "#6d4aff"] },
    { id: "journal", name: "Journal", style: "Personal", description: "Warm serif type for essays and diaries.", premium: false, accent: "#c2410c", layout: "list", swatch: ["#fbf7f0", "#2b2118", "#c2410c"] },
    { id: "letter", name: "Letter", style: "Newsletter", description: "Built around the subscribe box. Great for newsletters.", premium: false, accent: "#0f766e", layout: "list", swatch: ["#f4f7f6", "#10201d", "#0f766e"] },
    { id: "midnight", name: "Midnight", style: "Dark", description: "A dark theme with soft glow and high contrast.", premium: false, accent: "#a78bfa", layout: "grid", swatch: ["#0d0b16", "#ece9ff", "#a78bfa"] },
    { id: "paper", name: "Paper", style: "Magazine", description: "Featured story up top and a dense grid below.", premium: true, accent: "#dc2626", layout: "magazine", swatch: ["#ffffff", "#111111", "#dc2626"] },
    { id: "lens", name: "Lens", style: "Photo", description: "Big images, edge to edge. For photographers and travel blogs.", premium: true, accent: "#f59e0b", layout: "grid", swatch: ["#111111", "#fafafa", "#f59e0b"] },
    { id: "manual", name: "Manual", style: "Docs", description: "Sidebar navigation and readable code. For guides and changelogs.", premium: true, accent: "#2563eb", layout: "list", swatch: ["#f8fafc", "#0f172a", "#2563eb"] },
    { id: "arcade", name: "Arcade", style: "Retro", description: "Monospace, chunky shadows and a little nostalgia.", premium: true, accent: "#e11d48", layout: "list", swatch: ["#fff8e7", "#1d1a14", "#e11d48"] },
    { id: "bloom", name: "Bloom", style: "Colorful", description: "Gradient header and rounded cards. Friendly and bright.", premium: true, accent: "#db2777", layout: "grid", swatch: ["#fff5fb", "#2a1033", "#db2777"] },
    { id: "press", name: "Press", style: "Editorial", description: "Large serif headlines with a classic newspaper feel.", premium: true, accent: "#1f2937", layout: "magazine", swatch: ["#fdfcf9", "#141414", "#1f2937"] },
];

export function findTheme(id: string): ThemeInfo
{
    return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

export const FONTS = [
    { id: "", name: "Theme default" },
    { id: "inter", name: "Inter", stack: "Inter, ui-sans-serif, system-ui, sans-serif" },
    { id: "system", name: "System", stack: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" },
    { id: "serif", name: "Serif", stack: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif" },
    { id: "georgia", name: "Georgia", stack: "Georgia, 'Times New Roman', serif" },
    { id: "mono", name: "Mono", stack: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
    { id: "rounded", name: "Rounded", stack: "ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif" },
] as const;

export function fontStack(id: string): string | null
{
    const font = FONTS.find((item) => item.id === id);
    return font && "stack" in font ? font.stack : null;
}
