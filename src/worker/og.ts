import "./lib/location-shim";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import satori, { init as initSatori } from "satori/standalone";
import layoutWasm from "satori/yoga.wasm";
import { findTheme } from "../shared/settings";
import type { SiteWithSettings } from "../shared/types";
import type { AppEnv } from "./env";

// Social preview images: Satori lays out the card as SVG, resvg turns it into a PNG.
// Both are WebAssembly, compiled once per isolate on the first image request.

const WIDTH = 1200;
const HEIGHT = 630;

let wasmReady: Promise<unknown> | undefined;
let assetsReady: Promise<{ regular: ArrayBuffer; bold: ArrayBuffer; logo: string }> | undefined;

// Each WebAssembly module can be initialized only once per isolate, so it is memoized apart from
// the asset fetches, which are retried if they fail.
function initWasmOnce()
{
    wasmReady ??= Promise.all([
        initSatori(layoutWasm),
        // After a hot reload in dev, resvg keeps its earlier instance and refuses a second init.
        initWasm(resvgWasm).catch((error: Error) =>
        {
            if (!error.message.includes("Already initialized"))
            {
                throw error;
            }
        }),
    ]).catch((error) =>
    {
        wasmReady = undefined;
        throw error;
    });
    return wasmReady;
}

function load(env: AppEnv, origin: string)
{
    assetsReady ??= (async () =>
    {
        // Satori reads TTF, OTF and WOFF, but not WOFF2, so the cards use static WOFF files.
        const asset = async (path: string) =>
        {
            const response = await env.ASSETS.fetch(new Request(`${origin}${path}`));
            if (!response.ok)
            {
                throw new Error(`Missing asset ${path}`);
            }
            return response.arrayBuffer();
        };
        const [regular, bold, logo] = await Promise.all([
            asset("/_ws/fonts/geist-400.woff"),
            asset("/_ws/fonts/geist-700.woff"),
            asset("/_ws/logo-128.png"),
        ]);
        let binary = "";
        for (const byte of new Uint8Array(logo))
        {
            binary += String.fromCharCode(byte);
        }
        return { regular, bold, logo: `data:image/png;base64,${btoa(binary)}` };
    })().catch((error) =>
    {
        assetsReady = undefined;
        throw error;
    });
    return Promise.all([initWasmOnce(), assetsReady]).then(([, assets]) => assets);
}

type Node = { type: string; props: Record<string, unknown> & { style?: Record<string, unknown>; children?: unknown } };

function el(type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node
{
    return { type, props: { style: { display: "flex", ...style }, children, ...extra } };
}

export type OgCard = {
    title: string;
    eyebrow: string;
    footer: string;
    poweredBy: boolean;
};

export function accentFor(site: SiteWithSettings): string
{
    const theme = findTheme(site.settings.theme);
    return /^#[0-9a-f]{3,8}$/i.test(site.settings.accent) ? site.settings.accent : theme.accent;
}

// Changes whenever something drawn on the card changes, so cached images refresh.
export function cardVersion(site: SiteWithSettings, ...parts: (string | number)[]): string
{
    return [site.settings.theme, accentFor(site), site.title, ...parts].join("|");
}

export async function renderOgImage(env: AppEnv, origin: string, site: SiteWithSettings, card: OgCard): Promise<Uint8Array>
{
    const assets = await load(env, origin);
    const theme = findTheme(site.settings.theme);
    const [background, foreground] = theme.swatch;
    const accent = accentFor(site);
    const titleSize = card.title.length > 90 ? 52 : card.title.length > 55 ? 62 : 74;
    const tree = el("div", {
        width: WIDTH,
        height: HEIGHT,
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        backgroundColor: background,
        backgroundImage: `radial-gradient(circle at 100% 0%, ${accent}40 0%, ${background}00 55%)`,
        color: foreground,
        fontFamily: "Geist",
    }, [
        el("div", { alignItems: "center", gap: 16, fontSize: 30, fontWeight: 700 }, [
            el("div", { width: 18, height: 18, borderRadius: 9, backgroundColor: accent }),
            el("div", {}, card.eyebrow),
        ]),
        el("div", { fontSize: titleSize, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 1000 }, card.title),
        el("div", { alignItems: "center", justifyContent: "space-between", fontSize: 26, opacity: 0.75 }, [
            el("div", {}, card.footer),
            card.poweredBy
                ? el("div", { alignItems: "center", gap: 12, fontWeight: 700 }, [
                    el("img", { width: 40, height: 40 }, undefined, { src: assets.logo, width: 40, height: 40 }),
                    el("div", {}, "Writestead"),
                ])
                : el("div", {}),
        ]),
    ]);
    const svg = await satori(tree as never, {
        width: WIDTH,
        height: HEIGHT,
        fonts: [
            { name: "Geist", data: assets.regular, weight: 400, style: "normal" },
            { name: "Geist", data: assets.bold, weight: 700, style: "normal" },
        ],
    });
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } });
    const png = resvg.render().asPng();
    resvg.free();
    return png;
}

// Serves a card from the edge cache, rendering it only when its version is new.
export async function cachedOgResponse(request: Request, version: string, ctx: { waitUntil: (promise: Promise<unknown>) => void }, render: () => Promise<Uint8Array>): Promise<Response>
{
    const url = new URL(request.url);
    url.search = `?v=${encodeURIComponent(version)}`;
    const key = new Request(url.toString());
    // The Workers cache; the DOM typings the dashboard pulls in don't know about caches.default.
    const cache = (caches as unknown as { default: Cache }).default;
    const hit = await cache.match(key);
    if (hit)
    {
        return hit;
    }
    const png = await render();
    const response = new Response(png.slice().buffer as ArrayBuffer, {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
    ctx.waitUntil(cache.put(key, response.clone()));
    return response;
}
