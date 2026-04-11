const fs = require("node:fs");
const path = require("node:path");

const POSTS_PATH = path.join(__dirname, "..", "data", "posts.json");
const STATE_PATH = path.join(__dirname, "..", "data", "linkedin-last-posted.json");
const LINKEDIN_URL = "https://api.linkedin.com/v2/ugcPosts";

function readJson(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) {
    return fallbackValue;
  }

  const content = fs.readFileSync(filePath, "utf8").trim();
  return content ? JSON.parse(content) : fallbackValue;
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function getLatestPost() {
  const posts = readJson(POSTS_PATH, []);
  if (!posts.length) {
    return null;
  }

  return posts
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
}

function isAlreadyPosted(state, post) {
  return state && state.postId === post.id;
}

async function publishToLinkedIn(token, organizationId, post) {
  const author = `urn:li:organization:${organizationId}`;
  const postUrl = post.permalink || `https://reallyrealeducation.org/posts.html#${post.id}`;
  const text = [
    `${post.title}`,
    "",
    `${post.excerpt || ""}`,
    "",
    `Image: ${post.image}`,
    `Read: ${postUrl}`
  ].join("\n");

  const payload = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: {
          text
        },
        shareMediaCategory: "ARTICLE",
        media: [
          {
            status: "READY",
            originalUrl: postUrl,
            title: {
              text: post.title
            },
            description: {
              text: post.excerpt || "Daily quote post"
            }
          }
        ]
      }
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
    }
  };

  const response = await fetch(LINKEDIN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LinkedIn publish failed (${response.status}): ${errorBody}`);
  }

  return response.headers.get("x-restli-id") || "published";
}

async function main() {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const organizationId = process.env.LINKEDIN_ORGANIZATION_ID;

  if (!token || !organizationId) {
    console.log("LinkedIn credentials missing. Skipping auto-publish step.");
    return;
  }

  const latestPost = getLatestPost();
  if (!latestPost) {
    console.log("No posts found. Skipping LinkedIn publish.");
    return;
  }

  const state = readJson(STATE_PATH, null);
  if (isAlreadyPosted(state, latestPost)) {
    console.log("Latest post already published to LinkedIn.");
    return;
  }

  const resultId = await publishToLinkedIn(token, organizationId, latestPost);
  writeJson(STATE_PATH, {
    postId: latestPost.id,
    postDate: latestPost.date,
    publishedAt: new Date().toISOString(),
    linkedInPostId: resultId
  });

  console.log(`Published ${latestPost.id} to LinkedIn.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
