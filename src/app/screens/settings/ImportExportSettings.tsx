import { DownloadSimple, FileArrowUp } from "@phosphor-icons/react";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { useRef, useState } from "react";
import { type ImportBundle, parseGhost, parseMarkdownFile, parseMediumHtml, parseSubstack, parseSubscriberCsv, parseWordPress } from "../../../shared/importers";
import { Spinner } from "../../components/Spinner";
import { Switch } from "../../components/Switch";
import { toast } from "../../components/Toast";
import { api, errorMessage } from "../../lib/api";
import { useSession } from "../../lib/session";
import { SettingsCard } from "../SettingsScreen";

type Parsed = { source: string; bundle: ImportBundle };

// Files are parsed in the browser so big archives never hit the Worker's CPU limit.
async function parseFiles(files: File[]): Promise<Parsed>
{
    const texts: Record<string, string> = {};
    for (const file of files)
    {
        if (file.name.toLowerCase().endsWith(".zip"))
        {
            const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
            for (const [name, bytes] of Object.entries(entries))
            {
                if (/\.(json|xml|csv|html?|md|markdown|mdx)$/i.test(name) && !name.startsWith("__MACOSX"))
                {
                    texts[name] = strFromU8(bytes);
                }
            }
        }
        else
        {
            texts[file.name] = await file.text();
        }
    }
    const names = Object.keys(texts);
    const json = names.find((name) => name.endsWith(".json"));
    if (json)
    {
        return { source: "Ghost", bundle: parseGhost(texts[json]) };
    }
    const xml = names.find((name) => name.endsWith(".xml"));
    if (xml)
    {
        return { source: "WordPress", bundle: parseWordPress(texts[xml]) };
    }
    if (names.some((name) => /(^|\/)posts\.csv$/.test(name)))
    {
        return { source: "Substack", bundle: parseSubstack(texts) };
    }
    const markdown = names.filter((name) => /\.(md|markdown|mdx)$/i.test(name));
    if (markdown.length > 0)
    {
        return { source: "Markdown", bundle: { posts: markdown.map((name) => parseMarkdownFile(texts[name], name)), subscribers: [] } };
    }
    const html = names.filter((name) => /\.html?$/i.test(name));
    if (html.length > 0)
    {
        return { source: "Medium", bundle: { posts: html.map((name) => parseMediumHtml(texts[name], name)).filter((post) => post !== null), subscribers: [] } };
    }
    const csv = names.find((name) => name.endsWith(".csv"));
    if (csv)
    {
        return { source: "Subscriber CSV", bundle: { posts: [], subscribers: parseSubscriberCsv(texts[csv]) } };
    }
    throw new Error("We couldn't recognize that file. Upload a Ghost JSON, WordPress XML, Substack or Medium ZIP, Markdown files, or a CSV.");
}

const IMAGE = /(?:src="|!\[[^\]]*\]\(|^)(https?:\/\/[^"\s)]+\.(?:png|jpe?g|gif|webp|avif)(?:\?[^"\s)]*)?)/gim;

function downloadBlob(data: BlobPart, name: string, type: string)
{
    const url = URL.createObjectURL(new Blob([data], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() =>
    {
        URL.revokeObjectURL(url);
    }, 1000);
}

export function ImportExportSettings()
{
    const { me } = useSession();
    const input = useRef<HTMLInputElement>(null);
    const [parsed, setParsed] = useState<Parsed | null>(null);
    const [rehost, setRehost] = useState(true);
    const [progress, setProgress] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    async function choose(files: File[])
    {
        try
        {
            setParsed(await parseFiles(files));
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
    }

    async function runImport()
    {
        if (!parsed)
        {
            return;
        }
        const bundle = structuredClone(parsed.bundle);
        if (rehost)
        {
            const urls = new Set<string>();
            for (const post of bundle.posts)
            {
                for (const match of `${post.content}\n${post.cover_image}`.matchAll(IMAGE))
                {
                    urls.add(match[1]);
                }
            }
            const mapped = new Map<string, string>();
            let done = 0;
            for (const url of urls)
            {
                setProgress(`Copying images ${++done} of ${urls.size}`);
                const result = await api<{ url: string }>("/admin/import/image", { body: { url } }).catch(() => ({ url }));
                mapped.set(url, result.url);
            }
            for (const post of bundle.posts)
            {
                for (const [from, to] of mapped)
                {
                    post.content = post.content.replaceAll(from, to);
                    post.cover_image = post.cover_image === from ? to : post.cover_image;
                }
            }
        }
        setProgress("Importing posts and subscribers");
        try
        {
            const result = await api<{ posts: number; subscribers: number }>("/admin/import", { body: bundle });
            toast(`Imported ${result.posts} posts and ${result.subscribers} subscribers`);
            setParsed(null);
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
        setProgress(null);
    }

    // Downloads every uploaded file through the blog and zips it in the browser.
    async function exportMedia()
    {
        setExporting(true);
        try
        {
            const { media } = await api<{ media: { key: string; url: string }[] }>("/admin/media");
            const files: Record<string, Uint8Array> = {};
            for (const [index, item] of media.entries())
            {
                setProgress(`Downloading files ${index + 1} of ${media.length}`);
                const response = await fetch(item.url);
                if (response.ok)
                {
                    files[item.key.split("/").slice(1).join("/")] = new Uint8Array(await response.arrayBuffer());
                }
            }
            downloadBlob(zipSync(files, { level: 0 }) as BlobPart, `writestead-media-${new Date().toISOString().slice(0, 10)}.zip`, "application/zip");
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
        setProgress(null);
        setExporting(false);
    }

    async function exportAs(kind: "json" | "markdown")
    {
        setExporting(true);
        try
        {
            const data = await api<{ posts: { type: string; title: string; slug: string; excerpt: string; content: string; status: string; published_at: number | null; cover_image: string }[] }>("/admin/export");
            const stamp = new Date().toISOString().slice(0, 10);
            if (kind === "json")
            {
                downloadBlob(JSON.stringify(data, null, 2), `writestead-${stamp}.json`, "application/json");
            }
            else
            {
                const files: Record<string, Uint8Array> = {};
                for (const post of data.posts)
                {
                    const front = [
                        "---",
                        `title: ${JSON.stringify(post.title)}`,
                        `slug: ${post.slug}`,
                        post.published_at ? `date: ${new Date(post.published_at * 1000).toISOString()}` : "",
                        `status: ${post.status}`,
                        post.excerpt ? `description: ${JSON.stringify(post.excerpt)}` : "",
                        post.cover_image ? `cover_image: ${post.cover_image}` : "",
                        post.type === "page" ? "type: page" : "",
                        "---",
                    ].filter(Boolean).join("\n");
                    files[`${post.type === "page" ? "pages" : "posts"}/${post.slug}.md`] = strToU8(`${front}\n\n${post.content}\n`);
                }
                downloadBlob(zipSync(files) as BlobPart, `writestead-markdown-${stamp}.zip`, "application/zip");
            }
        }
        catch (caught)
        {
            toast(errorMessage(caught), "error");
        }
        setExporting(false);
    }

    return (
        <>
            <SettingsCard title="Import" description="Bring posts, pages, tags, images and subscribers from Ghost, WordPress, Substack, Medium or Markdown files.">
                <button
                    type="button"
                    onClick={() =>
                    {
                        input.current?.click();
                    }}
                    onDragOver={(event) =>
                    {
                        event.preventDefault();
                    }}
                    onDrop={(event) =>
                    {
                        event.preventDefault();
                        void choose([...event.dataTransfer.files]);
                    }}
                    className="flex flex-col items-center gap-2 rounded-2xl bg-zinc-900/[0.03] px-6 py-10 text-center transition-colors hover:bg-brand/8 dark:bg-white/[0.04]"
                >
                    <FileArrowUp className="size-8 text-brand" />
                    <span className="text-sm font-semibold">Drop an export here or choose files</span>
                    <span className="muted text-xs">Ghost .json, WordPress .xml, Substack or Medium .zip, .md files, subscriber .csv</span>
                </button>
                <input ref={input} type="file" multiple className="hidden" accept=".json,.xml,.zip,.md,.markdown,.mdx,.csv,.html" onChange={(event) =>
                {
                    void choose([...(event.target.files ?? [])]);
                    event.target.value = "";
                }} />
                {parsed && (
                    <div className="rounded-xl bg-brand/8 p-4">
                        <p className="text-sm font-semibold">{parsed.source} export ready</p>
                        <p className="muted mt-1 text-sm">{parsed.bundle.posts.filter((post) => post.type === "post").length} posts, {parsed.bundle.posts.filter((post) => post.type === "page").length} pages and {parsed.bundle.subscribers.length} subscribers. Paid members come in as complimentary until they pay through your Stripe.</p>
                        <div className="mt-3"><Switch label="Copy images to your media library" description="So posts keep working if the old site goes away." checked={rehost} onChange={setRehost} /></div>
                        <div className="mt-3 flex gap-2">
                            <button type="button" className="btn-primary" disabled={progress !== null} onClick={runImport}>{progress !== null && <Spinner />}{progress ?? "Import now"}</button>
                            <button type="button" className="btn-ghost" disabled={progress !== null} onClick={() =>
                            {
                                setParsed(null);
                            }}>Cancel</button>
                        </div>
                    </div>
                )}
            </SettingsCard>
            <SettingsCard title="Export" description="Your content is yours. Download it any time, in open formats.">
                <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary" disabled={exporting} onClick={() =>
                    {
                        void exportAs("json");
                    }}><DownloadSimple />Everything as JSON</button>
                    <button type="button" className="btn-secondary" disabled={exporting} onClick={() =>
                    {
                        void exportAs("markdown");
                    }}><DownloadSimple />Posts as Markdown ZIP</button>
                    <a className="btn-secondary" href="/api/admin/subscribers/export"><DownloadSimple />Subscribers as CSV</a>
                    <button type="button" className="btn-secondary" disabled={exporting} onClick={() =>
                    {
                        void exportMedia();
                    }}><DownloadSimple />Images and files as ZIP</button>
                </div>
                <p className="muted text-xs">The JSON export lists every image with its URL on {me.url.replace(/^https?:\/\//, "")}, so you can download your media too.</p>
            </SettingsCard>
        </>
    );
}
