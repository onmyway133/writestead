import { describe, expect, it } from "vitest";
import { parseGhost, parseMarkdownFile, parseMediumHtml, parseSubstack, parseWordPress } from "../src/shared/importers";

describe("importers", () =>
{
    it("reads a Ghost export with tags and members", () =>
    {
        const json = JSON.stringify({ db: [{ data: {
            posts: [{ id: "1", title: "Hello", slug: "hello", html: "<p>Hi</p>", status: "published", published_at: "2024-01-02T03:04:05.000Z", visibility: "paid", feature_image: "https://x/y.jpg" }],
            tags: [{ id: "t", name: "News" }, { id: "i", name: "#internal" }],
            posts_tags: [{ post_id: "1", tag_id: "t" }, { post_id: "1", tag_id: "i" }],
            members: [{ email: "a@b.co", name: "A", status: "paid" }],
        } }] });
        const bundle = parseGhost(json);
        expect(bundle.posts[0]).toMatchObject({ title: "Hello", status: "published", visibility: "paid", tags: ["News"], cover_image: "https://x/y.jpg", published_at: 1704164645 });
        expect(bundle.subscribers[0]).toMatchObject({ email: "a@b.co", tier: "paid" });
    });

    it("reads WordPress WXR items and skips attachments", () =>
    {
        const xml = `<rss><channel>
<item><title>Pic</title><wp:post_id>9</wp:post_id><wp:post_type><![CDATA[attachment]]></wp:post_type><wp:attachment_url>https://w/p.jpg</wp:attachment_url></item>
<item><title>My &amp; Post</title><wp:post_name><![CDATA[my-post]]></wp:post_name><wp:post_type><![CDATA[post]]></wp:post_type><wp:status><![CDATA[publish]]></wp:status>
<wp:post_date_gmt><![CDATA[2023-05-06 07:08:09]]></wp:post_date_gmt><content:encoded><![CDATA[<!-- wp:paragraph --><p>Body</p><!-- /wp:paragraph -->]]></content:encoded>
<category domain="post_tag" nicename="x"><![CDATA[Travel]]></category>
<wp:postmeta><wp:meta_key><![CDATA[_thumbnail_id]]></wp:meta_key><wp:meta_value><![CDATA[9]]></wp:meta_value></wp:postmeta></item>
</channel></rss>`;
        const { posts } = parseWordPress(xml);
        expect(posts).toHaveLength(1);
        expect(posts[0]).toMatchObject({ title: "My & Post", slug: "my-post", content: "<p>Body</p>", tags: ["Travel"], cover_image: "https://w/p.jpg", status: "published" });
    });

    it("reads a Substack export", () =>
    {
        const bundle = parseSubstack({
            "posts.csv": "post_id,post_date,is_published,title,subtitle,type,audience\n123.first-post,2024-02-03T10:00:00.000Z,true,First,Sub,newsletter,only_paid\n",
            "posts/123.first-post.html": "<p>Hello</p>",
            "email_list.abc.csv": "email,active_subscription,plan\nx@y.co,true,paid\n",
        });
        expect(bundle.posts[0]).toMatchObject({ slug: "first-post", content: "<p>Hello</p>", visibility: "paid", excerpt: "Sub" });
        expect(bundle.subscribers[0]).toMatchObject({ email: "x@y.co", tier: "paid" });
    });

    it("reads a Medium post", () =>
    {
        const html = `<html><head><title>T</title></head><body><article><header><h1 class="p-name">Medium Title</h1></header>
<section data-field="subtitle" class="p-summary">Short</section><section data-field="body" class="e-content"><p class="graf">Text</p></section>
<footer><time class="dt-published" datetime="2022-01-01T00:00:00.000Z">x</time><a href="https://medium.com/@me/medium-title-abc123def456" class="p-canonical">c</a></footer></article></body></html>`;
        expect(parseMediumHtml(html, "posts/2022-01-01_Medium-Title.html")).toMatchObject({ title: "Medium Title", slug: "medium-title", excerpt: "Short", status: "published", content: "<p>Text</p>" });
    });

    it("reads Markdown front matter", () =>
    {
        const post = parseMarkdownFile("---\ntitle: \"Hi there\"\ndate: 2021-03-04\ntags:\n  - a\n  - b\ndraft: true\n---\nBody text", "2021-03-04-hi-there.md");
        expect(post).toMatchObject({ title: "Hi there", slug: "hi-there", tags: ["a", "b"], status: "draft", content: "Body text" });
    });
});
