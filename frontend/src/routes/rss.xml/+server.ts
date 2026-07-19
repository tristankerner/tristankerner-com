import { SITE_NAME, SITE_URL } from "$lib/blog/config";
import { posts } from "$lib/blog/posts";

export const prerender = true;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export const GET = () => {
  const items = posts
    .map((post) => {
      const permalink = `${SITE_URL}/blog/${post.date}/${post.slug}`;
      return `    <item>
      <title>${escapeXml(post.metadata.title)}</title>
      <link>${permalink}</link>
      <guid isPermaLink="true">${permalink}</guid>
      <pubDate>${new Date(`${post.date}T00:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeXml(post.metadata.excerpt)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${SITE_NAME} — Blog`)}</title>
    <link>${SITE_URL}/blog</link>
    <description>Posts on software, projects, and whatever else I've been building.</description>
    <language>en</language>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml" },
  });
};
