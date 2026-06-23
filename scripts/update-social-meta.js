const fs = require("node:fs");
const path = require("node:path");

const POSTS_PATH = path.join(__dirname, "..", "data", "posts.json");
const POSTS_HTML_PATH = path.join(__dirname, "..", "Cogentic.html");
const SITE_URL = process.env.SITE_URL || "https://reallyrealeducation.org";

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf8").trim();
  return raw ? JSON.parse(raw) : [];
}

function replaceMeta(html, id, content) {
  const escaped = String(content).replaceAll('"', "&quot;");
  const pattern = new RegExp(`(<meta[^>]*id=\\"${id}\\"[^>]*content=\\")[^\\"]*(\\"[^>]*>)`);
  if (!pattern.test(html)) {
    return html;
  }
  return html.replace(pattern, `$1${escaped}$2`);
}

function main() {
  const posts = readJson(POSTS_PATH)
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!posts.length) {
    console.log("No posts found. Skipping social meta update.");
    return;
  }

  const latest = posts[0];
  const postUrl = latest.permalink || `${SITE_URL}/posts/${latest.id}.html`;
  const title = `${latest.title} — Really Real Education`;
  const description = latest.excerpt || "Daily learning quote from Really Real Education by Jalte Diye Foundation.";

  let html = fs.readFileSync(POSTS_HTML_PATH, "utf8");
  html = replaceMeta(html, "og-title", title);
  html = replaceMeta(html, "og-description", description);
  html = replaceMeta(html, "og-image", latest.image);
  html = replaceMeta(html, "og-url", postUrl);
  html = replaceMeta(html, "tw-title", title);
  html = replaceMeta(html, "tw-description", description);
  html = replaceMeta(html, "tw-image", latest.image);

  fs.writeFileSync(POSTS_HTML_PATH, html, "utf8");
  console.log(`Updated social meta tags for ${latest.id}.`);
}

main();
