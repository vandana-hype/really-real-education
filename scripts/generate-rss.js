const fs = require("node:fs");
const path = require("node:path");

const POSTS_PATH = path.join(__dirname, "..", "data", "posts.json");
const RSS_PATH = path.join(__dirname, "..", "rss.xml");
const SITE_URL = process.env.SITE_URL || "https://reallyrealeducation.org";

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function readPosts() {
  if (!fs.existsSync(POSTS_PATH)) {
    return [];
  }

  const raw = fs.readFileSync(POSTS_PATH, "utf8").trim();
  return raw ? JSON.parse(raw) : [];
}

function buildRss(posts) {
  const items = posts
    .map((post) => {
      const link = post.permalink || `${SITE_URL}/posts/${post.id}.html`;
      const description = `${post.excerpt || ""} <img src="${post.image}" alt="${post.title}">`;
      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid>${escapeXml(link)}</guid>`,
        `      <pubDate>${new Date(post.date).toUTCString()}</pubDate>`,
        `      <description><![CDATA[${description}]]></description>`,
        `      <enclosure url="${escapeXml(post.image)}" length="0" type="image/jpeg"/>`,
        `      <media:content url="${escapeXml(post.image)}" medium="image" type="image/jpeg"/>`,
        "    </item>"
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">',
    '  <channel>',
    '    <title>Really Real Education Daily Posts</title>',
    `    <link>${SITE_URL}/Cogentic.html</link>`,
    '    <description>Automated daily quote posts feed.</description>',
    items,
    '  </channel>',
    '</rss>',
    ''
  ].join("\n");
}

function main() {
  const posts = readPosts().sort((a, b) => new Date(b.date) - new Date(a.date));
  const rss = buildRss(posts);
  fs.writeFileSync(RSS_PATH, rss, "utf8");
  console.log(`Generated RSS with ${posts.length} posts.`);
}

main();
