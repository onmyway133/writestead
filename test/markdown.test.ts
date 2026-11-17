import { describe, expect, it } from "vitest";
import { embedFor, renderMarkdown, splitPaywall } from "../src/shared/markdown";

describe("markdown", () =>
{
    it("turns a lone YouTube link into an embed", () =>
    {
        const html = renderMarkdown("Intro\n\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ\n\nOutro");
        expect(html).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    });

    it("leaves links inside code fences alone", () =>
    {
        const html = renderMarkdown("```\nhttps://youtu.be/dQw4w9WgXcQ\n```");
        expect(html).not.toContain("iframe");
    });

    it("highlights code blocks", () =>
    {
        const html = renderMarkdown("```js\nconst a = 1;\n```");
        expect(html).toContain("hljs-keyword");
    });

    it("knows gists, CodePen and X posts", () =>
    {
        expect(embedFor("https://gist.github.com/someone/0123abcd")).toContain("gist.github.com/someone/0123abcd.js");
        expect(embedFor("https://codepen.io/someone/pen/abcXYZ")).toContain("/embed/abcXYZ");
        expect(embedFor("https://x.com/someone/status/123456")).toContain("twitter-tweet");
        expect(embedFor("https://example.com/page")).toBeNull();
    });

    it("splits at the paywall marker", () =>
    {
        expect(splitPaywall("free part\n<!--paywall-->\npaid part")).toEqual({ preview: "free part\n", hasMarker: true });
        expect(splitPaywall("no marker").hasMarker).toBe(false);
    });
});

describe("excerpt", () =>
{
    it("never includes text after the paywall", async () =>
    {
        const { excerptOf } = await import("../src/worker/lib/text");
        const excerpt = excerptOf("Free intro.\n\nhttps://youtu.be/abc\n\n<!--paywall-->\n\nSecret part");
        expect(excerpt).toBe("Free intro.");
    });
});
