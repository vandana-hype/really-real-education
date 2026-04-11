(function () {
  const feedContainer = document.getElementById("posts-feed");
  const postsUrl = "data/posts.json";
  // Fallback post: day-of-year image shown when posts.json cannot be fetched.
  // Updated to day 101 = April 11 = quote_101.jpg
  const fallbackPosts = [
    {
      id: "post-2026-04-11",
      title: "Daily Quote 101",
      date: "2026-04-11",
      excerpt: "Daily learning quote post #101.",
      image: "https://raw.githubusercontent.com/Jalte-Diye-Foundation/Cogentic/main/Background1/quote_101.jpg"
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
    return `${window.location.origin}${window.location.pathname}#${postId}`;
  }

  // LinkedIn previews are best when sharing the page URL with OG tags.
  function getLinkedInShareUrl(post) {
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getPostUrl(post.id))}`;
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

  // X shares the post URL; the preview image comes from twitter:card meta tags on posts.html.
  function getXShareUrl(post) {
    const text = createQuoteMessage(post);
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(getPostUrl(post.id))}`;
  }

  // Facebook scrapes the image URL directly and shows it as a photo preview.
  function getFacebookShareUrl(post) {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(post.image)}`;
  }

  // Instagram and YouTube: copy image URL first so it's easy to attach, then the caption.
  function createCaption(post) {
    const postUrl = getPostUrl(post.id);
    return `${post.image}\n\n${post.title}\n${post.excerpt}\n\nReally Real Education — Jalte Diye Foundation\n${postUrl}`;
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
    set("og-url", getPostUrl(post.id));
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

  function onManualShare(platform, post) {
    const caption = createCaption(post);
    copyTextToClipboard(caption)
      .then(() => {
        alert(`Caption copied. Paste it on ${platform}.`);
        if (platform === "Instagram") {
          window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
          return;
        }
        window.open("https://studio.youtube.com/", "_blank", "noopener,noreferrer");
      })
      .catch(() => {
        alert(`Copy failed. Please copy manually and post on ${platform}.`);
      });
  }

  function onLinkedInShare(post) {
    const caption = `${createQuoteMessage(post)}\n\n${getPostUrl(post.id)}`;
    copyTextToClipboard(caption)
      .then(() => {
        alert("Caption copied. Paste it in LinkedIn after the preview loads.");
        window.open(getLinkedInShareUrl(post), "_blank", "noopener,noreferrer");
      })
      .catch(() => {
        window.open(getLinkedInShareUrl(post), "_blank", "noopener,noreferrer");
      });
  }

  function renderPosts(posts) {
    if (!posts.length) {
      feedContainer.innerHTML = '<article class="post-card"><p>No posts yet. The daily automation will add one shortly.</p></article>';
      return;
    }

    // Update OG tags with the newest (first) post so page-level shares show today's image.
    updateOgTags(posts[0]);

    feedContainer.innerHTML = posts
      .map((post) => {
        const xUrl = getXShareUrl(post);
        const facebookUrl = getFacebookShareUrl(post);
        return `
          <article class="post-card" id="${escapeHtml(post.id)}">
            <img class="post-image" src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}" loading="lazy">
            <div class="post-body">
              <h2 class="post-title"><strong>Daily Quote</strong></h2>
              <p>${escapeHtml(post.excerpt)}</p>
              <div class="post-actions">
                <button class="btn linkedin-share" type="button" data-post-id="${escapeHtml(post.id)}">Share on LinkedIn</button>
                <a class="btn secondary share-btn" href="${xUrl}" target="_blank" rel="noopener noreferrer">Share on X</a>
                <a class="btn secondary share-btn" href="${facebookUrl}" target="_blank" rel="noopener noreferrer">Share on Facebook</a>
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

    const linkedInButtons = feedContainer.querySelectorAll(".linkedin-share");
    linkedInButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const postId = button.getAttribute("data-post-id") || "";
        const post = postById[postId];
        if (!post) {
          return;
        }
        onLinkedInShare(post);
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
