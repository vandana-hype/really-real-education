const fs = require("node:fs");
const path = require("node:path");

const POSTS_PATH = path.join(__dirname, "..", "data", "posts.json");
const SITE_URL = process.env.SITE_URL || "https://reallyrealeducation.org";
const QUOTE_BASE_URL = "https://raw.githubusercontent.com/Jalte-Diye-Foundation/Cogentic/main/Background1";

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

function formatToday() {
  return new Date().toISOString().slice(0, 10);
}

// Returns 1 on Jan 1, 2 on Jan 2, ..., 365 on Dec 31 (or 366 in a leap year).
// Resets to 1 every new year, cycling through all 365 images.
function getDayOfYear(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.floor((date - startOfYear) / 86400000) + 1;
}

function createPost(today, imageNumber) {
  const padded = String(imageNumber).padStart(3, "0");
  const id = `post-${today}`;

  return {
    id,
    title: `Daily Quote ${padded}`,
    date: today,
    excerpt: `Daily learning quote post #${padded}.`,
    image: "",
    imageNumber,
    permalink: `${SITE_URL}/posts.html#${id}`
  };
}

async function imageExists(url) {
  const response = await fetch(url, { method: "HEAD" });
  return response.ok;
}

async function resolveImageUrl(imageNumber) {
  const padded = String(imageNumber).padStart(3, "0");
  const candidates = [
    `${QUOTE_BASE_URL}/quote${imageNumber}.jpg`,
    `${QUOTE_BASE_URL}/quote_${padded}.jpg`
  ];

  for (const candidate of candidates) {
    if (await imageExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function main() {
  const posts = readPosts();
  const today = formatToday();

  if (posts.some((post) => post.date === today)) {
    console.log("A post for today already exists.");
    return;
  }

  // Image number = day of year (1–365), resets to 1 each January 1st.
  const imageNumber = getDayOfYear(today);
  const post = createPost(today, imageNumber);

  const resolvedImageUrl = await resolveImageUrl(imageNumber);
  if (!resolvedImageUrl) {
    console.log(`Image not found for ${post.title} (day ${imageNumber}). Skipping today's post.`);
    return;
  }

  post.image = resolvedImageUrl;

  posts.unshift(post);

  writePosts(posts);
  console.log(`Added ${post.title} for ${today}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
