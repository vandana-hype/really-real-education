const fs = require("node:fs");
const path = require("node:path");

const POSTS_PATH = path.join(__dirname, "..", "data", "posts.json");
const STATE_PATH = path.join(__dirname, "..", "data", "linkedin-last-posted.json");
const LINKEDIN_UGC_URL = "https://api.linkedin.com/v2/ugcPosts";
const LINKEDIN_REGISTER_UPLOAD_URL = "https://api.linkedin.com/v2/assets?action=registerUpload";

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

function buildShareText(post) {
  const quoteNumber = post.imageNumber || (post.title.match(/(\d+)/)?.[1] || "");
  const postUrl = post.permalink || `https://reallyrealeducation.org/posts.html#${post.id}`;

  return [
    `Quote ${quoteNumber}`,
    "A small thought. A deeper meaning.",
    "",
    "If this resonates, share it with someone who needs it today.",
    "",
    "#DailyQuote #WorldPeace  #Education #LifelongLearning #Wisdom #SelfGrowth #InnerPeace",
    "",
    postUrl
  ].join("\n");
}

async function registerImageUpload(token, authorUrn) {
  const payload = {
    registerUploadRequest: {
      recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
      owner: authorUrn,
      serviceRelationships: [
        {
          relationshipType: "OWNER",
          identifier: "urn:li:userGeneratedContent"
        }
      ]
    }
  };

  const response = await fetch(LINKEDIN_REGISTER_UPLOAD_URL, {
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
    throw new Error(`LinkedIn register upload failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const uploadUrl = data?.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
  const assetUrn = data?.value?.asset;

  if (!uploadUrl || !assetUrn) {
    throw new Error("LinkedIn register upload response missing upload URL or asset URN.");
  }

  return { uploadUrl, assetUrn };
}

async function uploadImageToLinkedIn(uploadUrl, imageUrl) {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image (${imageResponse.status}): ${imageUrl}`);
  }

  const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType
    },
    body: imageBuffer
  });

  if (!uploadResponse.ok) {
    const errorBody = await uploadResponse.text();
    throw new Error(`LinkedIn image upload failed (${uploadResponse.status}): ${errorBody}`);
  }
}

async function publishToLinkedIn(token, organizationId, post) {
  const author = `urn:li:organization:${organizationId}`;
  const text = buildShareText(post);

  const { uploadUrl, assetUrn } = await registerImageUpload(token, author);
  await uploadImageToLinkedIn(uploadUrl, post.image);

  const payload = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: {
          text
        },
        shareMediaCategory: "IMAGE",
        media: [
          {
            status: "READY",
            media: assetUrn,
            title: {
              text: "Daily Quote"
            }
          }
        ]
      }
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
    }
  };

  const response = await fetch(LINKEDIN_UGC_URL, {
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
