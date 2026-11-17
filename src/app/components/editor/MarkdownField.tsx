import {
    Code, Image, LinkSimple, LockSimple, Quotes, TextB, TextHTwo, TextItalic, VideoCamera,
} from "@phosphor-icons/react";
import { type ClipboardEvent, type DragEvent, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { errorMessage } from "../../lib/api";
import { Spinner } from "../Spinner";
import { toast } from "../Toast";
import { uploadMedia } from "./upload";

// The Markdown textarea with a small toolbar. Images can be picked, dropped or pasted; each one
// uploads to R2 and lands in the text as ![](url).
export function MarkdownField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean })
{
    const ref = useRef<HTMLTextAreaElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(0);
    const [dragging, setDragging] = useState(false);
    // Latest value for async inserts that finish after more typing.
    const latest = useRef(value);
    latest.current = value;

    useLayoutEffect(() =>
    {
        const textarea = ref.current;
        if (textarea)
        {
            textarea.style.height = "auto";
            textarea.style.height = `${Math.max(textarea.scrollHeight, 360)}px`;
        }
    }, [value]);

    function replaceSelection(make: (selected: string) => { text: string; select?: [number, number] })
    {
        const textarea = ref.current;
        if (!textarea)
        {
            return;
        }
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const { text, select } = make(value.slice(start, end));
        onChange(value.slice(0, start) + text + value.slice(end));
        requestAnimationFrame(() =>
        {
            textarea.focus();
            const [from, to] = select ?? [text.length, text.length];
            textarea.setSelectionRange(start + from, start + to);
        });
    }

    function wrap(before: string, after: string, placeholder: string)
    {
        replaceSelection((selected) =>
        {
            const inner = selected || placeholder;
            return { text: `${before}${inner}${after}`, select: [before.length, before.length + inner.length] };
        });
    }

    // Puts a block on its own lines, with blank lines around it.
    function block(text: string, selectOffset?: [number, number])
    {
        replaceSelection(() =>
        {
            const textarea = ref.current!;
            const before = value.slice(0, textarea.selectionStart);
            const prefix = before.length === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
            const full = `${prefix}${text}\n\n`;
            return { text: full, select: selectOffset ? [prefix.length + selectOffset[0], prefix.length + selectOffset[1]] : undefined };
        });
    }

    function prefixLines(prefix: string, placeholder: string)
    {
        replaceSelection((selected) =>
        {
            const text = (selected || placeholder).split("\n").map((line) => `${prefix}${line}`).join("\n");
            return { text, select: [prefix.length, text.length] };
        });
    }

    async function uploadFiles(files: File[])
    {
        const images = files.filter((file) => file.type.startsWith("image/"));
        if (images.length === 0)
        {
            return;
        }
        const textarea = ref.current;
        let position = textarea ? textarea.selectionStart : latest.current.length;
        for (const file of images)
        {
            const token = `![Uploading ${file.name}…]()`;
            const current = latest.current;
            const prefix = position === 0 || current.slice(0, position).endsWith("\n\n") ? "" : "\n\n";
            const inserted = `${prefix}${token}\n\n`;
            const next = current.slice(0, position) + inserted + current.slice(position);
            latest.current = next;
            onChange(next);
            position += inserted.length;
            setUploading((count) => count + 1);
            try
            {
                const url = await uploadMedia(file);
                const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
                const updated = latest.current.replace(token, `![${alt}](${url})`);
                latest.current = updated;
                onChange(updated);
            }
            catch (caught)
            {
                const updated = latest.current.replace(`${token}\n\n`, "").replace(token, "");
                latest.current = updated;
                onChange(updated);
                toast(errorMessage(caught), "error");
            }
            finally
            {
                setUploading((count) => count - 1);
            }
        }
    }

    function insertEmbed()
    {
        const url = prompt("Paste a YouTube, Vimeo, X, CodePen or GitHub gist link");
        if (url && /^https?:\/\//.test(url.trim()))
        {
            block(url.trim());
        }
    }

    function insertLink()
    {
        const url = prompt("Link address");
        if (url)
        {
            wrap("[", `](${url.trim()})`, "link text");
        }
    }

    const tools: { label: string; icon: ReactNode; run: () => void }[] = [
        { label: "Heading", icon: <TextHTwo />, run: () => prefixLines("## ", "Heading") },
        { label: "Bold", icon: <TextB />, run: () => wrap("**", "**", "bold text") },
        { label: "Italic", icon: <TextItalic />, run: () => wrap("_", "_", "italic text") },
        { label: "Link", icon: <LinkSimple />, run: insertLink },
        { label: "Quote", icon: <Quotes />, run: () => prefixLines("> ", "Quote") },
        { label: "Code block", icon: <Code />, run: () => block("```js\ncode\n```", [6, 10]) },
        { label: "Image", icon: <Image />, run: () => fileRef.current?.click() },
        { label: "Embed", icon: <VideoCamera />, run: insertEmbed },
        { label: "Paywall: free readers see everything above this line", icon: <LockSimple />, run: () => block("<!--paywall-->") },
    ];

    return (
        <div
            className="relative"
            onDragOver={(event: DragEvent) =>
            {
                if (event.dataTransfer.types.includes("Files"))
                {
                    event.preventDefault();
                    setDragging(true);
                }
            }}
            onDragLeave={() =>
            {
                setDragging(false);
            }}
            onDrop={(event: DragEvent) =>
            {
                if (event.dataTransfer.files.length > 0)
                {
                    event.preventDefault();
                    setDragging(false);
                    void uploadFiles([...event.dataTransfer.files]);
                }
            }}
        >
            <div className="sticky top-14 z-10 -mx-2 mb-2 flex flex-wrap items-center gap-0.5 rounded-xl bg-white/90 p-1 backdrop-blur dark:bg-[#131209]/90" role="toolbar" aria-label="Formatting">
                {tools.map((tool) => (
                    <button key={tool.label} type="button" className="icon-btn size-8 [&_svg]:size-[18px]" title={tool.label} aria-label={tool.label} onClick={tool.run} disabled={disabled}>
                        {tool.icon}
                    </button>
                ))}
                {uploading > 0 && <span className="muted ml-2 inline-flex items-center gap-1.5 text-xs"><Spinner className="size-3.5" />Uploading</span>}
                <span className="muted ml-auto hidden pr-2 text-xs sm:inline">Markdown · drop or paste images</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(event) =>
            {
                void uploadFiles([...(event.target.files ?? [])]);
                event.target.value = "";
            }} />
            <label htmlFor="post-content" className="sr-only">Post content in Markdown</label>
            <textarea
                id="post-content"
                ref={ref}
                value={value}
                disabled={disabled}
                onChange={(event) =>
                {
                    onChange(event.target.value);
                }}
                onPaste={(event: ClipboardEvent) =>
                {
                    const files = [...event.clipboardData.files];
                    if (files.some((file) => file.type.startsWith("image/")))
                    {
                        event.preventDefault();
                        void uploadFiles(files);
                    }
                }}
                placeholder="Start writing. Markdown works: ## for headings, **bold**, - lists. Paste a YouTube link on its own line to embed it."
                spellCheck
                className="block min-h-[360px] w-full resize-none overflow-hidden bg-transparent font-mono text-[15px] leading-7 text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-200"
            />
            {dragging && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-brand/10 text-sm font-semibold text-brand backdrop-blur-[1px]">
                    Drop images to upload
                </div>
            )}
        </div>
    );
}
