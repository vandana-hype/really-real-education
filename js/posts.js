(function () {
  const feedContainer = document.getElementById("posts-feed");
  const postsUrl = "data/posts.json";
  const latestPoster =
  "https://raw.githubusercontent.com/Jalte-Diye-Foundation/Cogentic/main/website_assets/latest/poster.jpg";
  // Fallback post: day-of-year image shown when posts.json cannot be fetched.
  // Updated to day 101 = April 11 = quote_101.jpg
  const fallbackPosts = [
    {
      id: "post-2026-04-11",
      title: "Daily Quote 101",
      date: "2026-04-11",
      excerpt: "Daily learning quote post #101.",
      image: "https://raw.githubusercontent.com/Jalte-Diye-Foundation/Cogentic/main/Background1/quote_101.jpg",
      imageNumber: 101,
      permalink: "https://reallyrealeducation.org/posts/post-2026-04-11.html"
    }
  ];

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatDate(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
      return isoDate;
    }

    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function getPostUrl(postId) {
    return `${window.location.origin}/posts/${postId}.html`;
  }

  function getResolvedPostUrl(post) {
    return post.permalink || getPostUrl(post.id);
  }

  function getQuoteNumber(post) {
    return post.imageNumber || (post.title.match(/(\d+)/)?.[1] || "");
  }

  function createQuoteMessage(post) {
    const quoteNumber = getQuoteNumber(post);
    return [
      `Quote ${quoteNumber}`,
      "A small thought. A deeper meaning.",
      "",
      "If this resonates, share it with someone who needs it today.",
      "",
      "#DailyQuote #WorldPeace  #Education #LifelongLearning #Wisdom #SelfGrowth #InnerPeace"
    ].join("\n");
  }

  // Caption used when a platform composer opens after image sharing/download.
  function createCaption(post) {
    return `${post.title}\n${post.excerpt}\n\n${createQuoteMessage(post)}\n\nReally Real Education — Jalte Diye Foundation`;
  }

  // Update Open Graph and Twitter Card meta tags so the page preview shows today's image
  // when someone shares the page URL itself (e.g. on WhatsApp, Slack, Discord).
  function updateOgTags(post) {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.setAttribute("content", value);
    };
    set("og-title", `${post.title} — Really Real Education`);
    set("og-description", post.excerpt || "Daily learning quote from Really Real Education.");
    set("og-image", post.image);
    set("og-url", getResolvedPostUrl(post));
    set("tw-title", `${post.title} — Really Real Education`);
    set("tw-description", post.excerpt || "Daily learning quote from Really Real Education.");
    set("tw-image", post.image);
    document.title = `${post.title} | Really Real Education`;
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    return Promise.resolve();
  }

  async function tryNativeImageShare(post) {
    if (!navigator.share || !navigator.canShare) {
      return false;
    }

    const response = await fetch(post.image);
    if (!response.ok) {
      return false;
    }

    const mimeType = response.headers.get("content-type") || "image/jpeg";
    const imageBlob = await response.blob();
    const quoteNumber = String(getQuoteNumber(post) || "image");
    const imageFile = new File([imageBlob], `quote-${quoteNumber}.jpg`, { type: mimeType });

    if (!navigator.canShare({ files: [imageFile] })) {
      return false;
    }

    await navigator.share({
      files: [imageFile],
      text: createCaption(post)
    });
    return true;
  }

  async function downloadPostImage(post) {
    const response = await fetch(post.image);
    if (!response.ok) {
      throw new Error("Image download failed");
    }

    const imageBlob = await response.blob();
    const quoteNumber = String(getQuoteNumber(post) || "image");
    const extension = imageBlob.type === "image/png" ? "png" : "jpg";
    const filename = `quote-${quoteNumber}.${extension}`;
    const objectUrl = URL.createObjectURL(imageBlob);

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  function openPlatformComposer(platform) {
    const urls = {
      LinkedIn: "https://www.linkedin.com/feed/",
      X: "https://x.com/compose/post",
      Facebook: "https://www.facebook.com/",
      Instagram: "https://www.instagram.com/",
      YouTube: "https://studio.youtube.com/"
    };

    const url = urls[platform] || "https://www.linkedin.com/feed/";
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function onManualShare(platform, post) {
    const caption = createCaption(post);

    try {
      const shared = await tryNativeImageShare(post);
      if (shared) {
        return;
      }
    } catch {
      // Fall back to download-and-open flow below when native share is unavailable.
    }

    Promise.all([downloadPostImage(post), copyTextToClipboard(caption)])
      .then(() => {
        alert(`Image downloaded and caption copied. Upload the image in ${platform} and paste the caption.`);
        openPlatformComposer(platform);
      })
      .catch(() => {
        alert(`Could not prepare image/caption automatically. Please save the image and post it manually on ${platform}.`);
        openPlatformComposer(platform);
      });
  }

  function renderPosts(posts) {
    if (!posts.length) {
      feedContainer.innerHTML = '<article class="post-card"><p>No posts yet. The daily automation will add one shortly.</p></article>';
      return;
    }

    // Update OG tags with the newest (first) post so page-level shares show today's image.
    updateOgTags(posts[0]);
    posts[0].image = latestPoster;

    feedContainer.innerHTML = posts
      .map((post) => {
        return `
          <article class="post-card" id="${escapeHtml(post.id)}">
             <img class="post-image"
src="${escapeHtml(
  post === posts[0] ? latestPoster : post.image
)}"alt="${escapeHtml(post.title)}" loading="lazy">
            <div class="post-body">
              <h2 class="post-title"><strong>Daily Quote</strong></h2>
              <p class="card-meta"><strong>Daily Quote ${escapeHtml(String(getQuoteNumber(post)))}</strong></p>
              <p class="card-meta">Last updated: ${escapeHtml(formatDate(post.date))}</p>
              <p>${escapeHtml(post.excerpt)}</p>
              <div class="post-actions">
                <button class="btn secondary share-btn manual-share" type="button" data-platform="LinkedIn" data-post-id="${escapeHtml(post.id)}">Share on LinkedIn</button>
                <button class="btn secondary share-btn manual-share" type="button" data-platform="X" data-post-id="${escapeHtml(post.id)}">Share on X</button>
                <button class="btn secondary share-btn manual-share" type="button" data-platform="Facebook" data-post-id="${escapeHtml(post.id)}">Share on Facebook</button>
                <button class="btn secondary share-btn manual-share" type="button" data-platform="Instagram" data-post-id="${escapeHtml(post.id)}">Share on Instagram</button>
                <button class="btn secondary share-btn manual-share" type="button" data-platform="YouTube" data-post-id="${escapeHtml(post.id)}">Share on YouTube</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    const postById = Object.fromEntries(posts.map((post) => [post.id, post]));
    const manualButtons = feedContainer.querySelectorAll(".manual-share");
    manualButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const platform = button.getAttribute("data-platform") || "Social";
        const postId = button.getAttribute("data-post-id") || "";
        const post = postById[postId];
        if (!post) {
          return;
        }
        onManualShare(platform, post);
      });
    });
  }

  fetch(postsUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load posts: ${response.status}`);
      }
      return response.json();
    })
    .then((posts) => {
      posts.sort((a, b) => new Date(b.date) - new Date(a.date));
      renderPosts(posts);
    })
    .catch((error) => {
      // Local file previews and restrictive hosts can block JSON fetch; show the first quote post as fallback.
      console.warn("Unable to load posts.json, using fallback post list.", error);
      renderPosts(fallbackPosts);
    });
})();
