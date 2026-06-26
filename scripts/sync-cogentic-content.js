const fs = require("node:fs");
const path = require("node:path");

const POSTS_PATH = path.join(__dirname, "..", "data", "posts.json");
const SITE_URL = process.env.SITE_URL || "https://reallyrealeducation.org";

// TODO: switch to the org repo once the deploy-pipeline fix is merged upstream:
// "https://raw.githubusercontent.com/Jalte-Diye-Foundation/Cogentic/main"
const COGENTIC_REPO_RAW =
  process.env.COGENTIC_REPO_RAW ||
  "https://raw.githubusercontent.com/vandana-hype/Cogentic/main";

const METADATA_URL = `${COGENTIC_REPO_RAW}/website_assets/latest/metadata.json`;
const POSTER_URL = `${COGENTIC_REPO_RAW}/website_assets/latest/poster.jpg`;
const COGENTIC_POST_ID = "post-cogentic-ai-daily";

function readPosts() {
  if (!fs.existsSync(POSTS_PATH)) {
    return [];
  }
  const content = fs.readFileSync(POSTS_PATH, "utf8").trim();
  return content ? JSON.parse(content) : [];
}

function writePosts(posts) {
  fs.writeFileSync(POSTS_PATH, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
}

async function fetchMetadata() {
  const response = await fetch(METADATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not fetch Cogentic metadata.json: ${response.status}`);
  }
  return response.json();
}

function buildPost(metadata) {
  const quote = (metadata.quote || "").trim();
  const explanation = (metadata.explanation || "").trim();
  const caption = (metadata.caption || "").trim();

  return {
    id: COGENTIC_POST_ID,
    title: quote || "AI Quote of the Day",
    date: metadata.date || new Date().toISOString().slice(0, 10),
    excerpt: explanation || caption || "Daily AI-generated quote from Cogentic.",
    image: POSTER_URL,
    source: metadata.source || "Cogentic AI",
    theme: metadata.theme || "",
    hashtags: metadata.hashtags || [],
    permalink: `${SITE_URL}/posts/${COGENTIC_POST_ID}.html`
  };
}

async function main() {
  let metadata;
  try {
    metadata = await fetchMetadata();
  } catch (error) {
    console.log(`Skipping Cogentic sync: ${error.message}`);
    return;
  }

  if (!metadata.quote && !metadata.explanation) {
    console.log("Cogentic metadata.json has no quote/explanation yet — skipping sync for today.");
    return;
  }

  const post = buildPost(metadata);
  const posts = readPosts().filter((p) => p.id !== COGENTIC_POST_ID);
  posts.unshift(post);

  writePosts(posts);
  console.log(`Synced Cogentic AI post for ${post.date}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
