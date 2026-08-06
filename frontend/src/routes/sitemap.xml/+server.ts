import { SITE_URL } from "$lib/blog/config";
import { posts, totalPages } from "$lib/blog/posts";

export const prerender = true;

export const GET = () => {
  const staticPaths = ["/", "/about-me", "/memory-lane", "/blog"];
  // Page 1 lives at /blog itself, so the paginated route starts at page 2.
  const pagePaths = Array.from(
    { length: Math.max(0, totalPages() - 1) },
    (_, i) => `/blog/page/${i + 2}`,
  );

  const urls = [
    ...[...staticPaths, ...pagePaths].map((path) => `  <url><loc>${SITE_URL}${path}</loc></url>`),
    ...posts.map(
      (post) =>
        `  <url><loc>${SITE_URL}/blog/${post.date}/${post.slug}</loc><lastmod>${post.date}</lastmod></url>`,
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
};
