/* eslint-disable max-len */

/**
 * Parses the given URL and extracts its components.
 *
 * @param {string} url The URL to parse.
 * @returns {object} An object containing the parsed URL components.
 */
const parseUrl = (url) => {
    const urlObj = new URL(url);
    const urlParts = urlObj.pathname.split('/').filter((part) => part);

    const params = {};
    urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
    });

    const anchor = urlObj.hash.slice(1);

    return {
        anchor,
        baseUrl: urlObj.origin + urlObj.pathname,
        params,
        urlParts
    };
};

/**
 * Generates the HTML code for embedding a video based on the given URL.
 * Supports YouTube, YouTube Shorts, Vimeo (including unlisted), Dailymotion, Rumble, and Twitch.
 *
 * @param {string} url The URL of the video.
 * @returns {string} The HTML code for embedding the video.
 */
const getVideoHtml = (url) => {
    const urlObj = parseUrl(url);

    // YouTube - handle all formats including shorts, youtu.be, watch, embed, live
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = null;

        // Extract video ID from various YouTube URL formats
        // Format: youtube.com/watch?v=VIDEO_ID
        if (urlObj.params.v) {
            videoId = urlObj.params.v;
        } else if (urlObj.urlParts.length > 0) {
            // Format: youtu.be/VIDEO_ID or youtube.com/embed/VIDEO_ID or youtube.com/v/VIDEO_ID
            const lastPart = urlObj.urlParts[urlObj.urlParts.length - 1];
            // Check if it's shorts, embed, v, or live
            const secondLastPart = urlObj.urlParts.length > 1 ? urlObj.urlParts[urlObj.urlParts.length - 2] : '';

            if (secondLastPart === 'shorts' || secondLastPart === 'embed' ||
                secondLastPart === 'v' || secondLastPart === 'live') {
                videoId = lastPart;
            } else if (urlObj.urlParts.length === 1 && url.includes('youtu.be')) {
                // youtu.be/VIDEO_ID format
                videoId = lastPart;
            } else {
                videoId = lastPart;
            }
        }

        if (!videoId) {
            return `<iframe src="${url}" frameborder="0" allowfullscreen></iframe>`;
        }

        // Clean video ID (remove query parameters if any got attached)
        [videoId] = videoId.split('?')[0].split('&');

        // Build parameters
        let parameters = '?modestbranding=1';

        // Handle start time from both 't' and 'start' parameters
        if (urlObj.params.t) {
            // Remove 's' suffix if present (e.g., "30s" -> "30")
            const startTime = urlObj.params.t.replace(/s$/i, '');
            parameters += `&start=${startTime}`;
        } else if (urlObj.params.start) {
            parameters += `&start=${urlObj.params.start}`;
        }

        return `<iframe allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" frameborder="0" sandbox="allow-scripts allow-same-origin allow-presentation" src="https://www.youtube-nocookie.com/embed/${videoId}${parameters}"></iframe>`;
    }

    // Vimeo - handle standard and unlisted (with privacy hash)
    if (url.includes('vimeo.com')) {
        let videoId = null;
        let privacyHash = null;

        // Handle unlisted format: vimeo.com/VIDEO_ID/HASH or vimeo.com/VIDEO_ID?h=HASH
        if (urlObj.params.h) {
            // Format: vimeo.com/VIDEO_ID?h=HASH
            videoId = urlObj.urlParts[urlObj.urlParts.length - 1];
            privacyHash = urlObj.params.h;
        } else if (urlObj.urlParts.length >= 2) {
            // Format: vimeo.com/VIDEO_ID/HASH or vimeo.com/VIDEO_ID
            videoId = urlObj.urlParts[urlObj.urlParts.length - 2] || urlObj.urlParts[urlObj.urlParts.length - 1];

            // Check if last part looks like a hash (not numeric, contains letters)
            const lastPart = urlObj.urlParts[urlObj.urlParts.length - 1];
            if (lastPart && !/^\d+$/.test(lastPart) && lastPart !== videoId) {
                privacyHash = lastPart;
            }
        } else {
            videoId = urlObj.urlParts[urlObj.urlParts.length - 1];
        }

        if (!videoId) {
            return `<iframe src="${url}" frameborder="0" allowfullscreen></iframe>`;
        }

        // Build parameters
        let parameters = '';
        const allowedParams = ['title', 'byline', 'portrait', 'badge', 'autopause', 'autoplay', 'loop', 'muted'];

        allowedParams.forEach((param) => {
            if (urlObj.params[param]) {
                parameters += parameters ? `&${param}=${urlObj.params[param]}` : `?${param}=${urlObj.params[param]}`;
            }
        });

        // Add privacy hash if present (must be first parameter or after ?)
        let hashParam = '';
        if (privacyHash) {
            hashParam = parameters ? `&h=${privacyHash}` : `?h=${privacyHash}`;
        }

        return `<iframe src="https://player.vimeo.com/video/${videoId}${hashParam}${parameters}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    }

    // Dailymotion
    if (url.includes('dailymotion.com') || url.includes('dai.ly')) {
        let videoId = null;

        if (url.includes('dai.ly')) {
            // Short format: dai.ly/VIDEO_ID
            videoId = urlObj.urlParts[urlObj.urlParts.length - 1];
        } else {
            // Long format: dailymotion.com/video/VIDEO_ID
            const videoIndex = urlObj.urlParts.indexOf('video');
            if (videoIndex !== -1 && urlObj.urlParts.length > videoIndex + 1) {
                videoId = urlObj.urlParts[videoIndex + 1];
            } else {
                videoId = urlObj.urlParts[urlObj.urlParts.length - 1];
            }
        }

        if (!videoId) {
            return `<iframe src="${url}" frameborder="0" allowfullscreen></iframe>`;
        }

        // Clean video ID
        [videoId] = videoId.split('?')[0].split('_');

        return `<iframe frameborder="0" type="text/html" src="https://www.dailymotion.com/embed/video/${videoId}" allowfullscreen title="Dailymotion Video Player"></iframe>`;
    }

    // Rumble
    if (url.includes('rumble.com')) {
        let videoId = null;

        // Check if it's already an embed URL
        if (url.includes('/embed/')) {
            const embedIndex = urlObj.urlParts.indexOf('embed');
            if (embedIndex !== -1 && urlObj.urlParts.length > embedIndex + 1) {
                videoId = urlObj.urlParts[embedIndex + 1];
            }
        } else {
            // Standard format: rumble.com/VIDEO_ID-title.html
            // Video ID is the last part before .html
            const lastPart = urlObj.urlParts[urlObj.urlParts.length - 1];
            if (lastPart) {
                // Extract video ID from format like "v1a2b3c-title.html"
                const match = lastPart.match(/^(v[a-z0-9]+)/i);
                if (match) {
                    // eslint-disable-next-line prefer-destructuring
                    videoId = match[1];
                }
            }
        }

        if (!videoId) {
            return `<iframe src="${url}" frameborder="0" allowfullscreen></iframe>`;
        }

        // Clean video ID (remove trailing slashes or .html)
        videoId = videoId.replace(/\.html$/i, '').replace(/\/$/,  '');

        return `<iframe src="https://rumble.com/embed/${videoId}/" frameborder="0" allowfullscreen scrolling="no" allow="encrypted-media"></iframe>`;
    }

    // Twitch
    if (url.includes('twitch.tv')) {
        let videoId = null;
        let contentType = 'video'; // 'video', 'clip', or 'channel' (live)

        // Determine content type and extract ID
        if (url.includes('/videos/')) {
            contentType = 'video';
            const videoIndex = urlObj.urlParts.indexOf('videos');
            if (videoIndex !== -1 && urlObj.urlParts.length > videoIndex + 1) {
                videoId = urlObj.urlParts[videoIndex + 1];
            }
        } else if (url.includes('/clip/')) {
            contentType = 'clip';
            const clipIndex = urlObj.urlParts.indexOf('clip');
            if (clipIndex !== -1 && urlObj.urlParts.length > clipIndex + 1) {
                videoId = urlObj.urlParts[clipIndex + 1];
            }
        } else {
            // Assume it's a channel (live stream)
            contentType = 'channel';
            videoId = urlObj.urlParts[urlObj.urlParts.length - 1];
        }

        if (!videoId) {
            return `<iframe src="${url}" frameborder="0" allowfullscreen></iframe>`;
        }

        // Get parent domain from params or use a default
        const parent = urlObj.params.parent || 'localhost';

        let embedSrc = '';
        if (contentType === 'video') {
            embedSrc = `https://player.twitch.tv/?video=${videoId}&parent=${parent}`;
        } else if (contentType === 'clip') {
            embedSrc = `https://clips.twitch.tv/embed?clip=${videoId}&parent=${parent}`;
        } else {
            // Live channel
            embedSrc = `https://player.twitch.tv/?channel=${videoId}&parent=${parent}`;
        }

        return `<iframe src="${embedSrc}" frameborder="0" allowfullscreen="true" scrolling="no" height="378" width="620"></iframe>`;
    }

    // Fallback for unknown or direct iframe URLs
    return `<iframe src="${url}" frameborder="0" allowfullscreen></iframe>`;
};

/**
 * Converts video elements to video figures with embedded videos.
 *
 * @param {object} scope - The scope object containing the dom, cwd, and relPath
 */
const jamsEduVideo = (scope) => {
    // Find all video tags with src attribute
    const videoNodes = scope.dom.querySelectorAll('video[src]');

    for (const videoNode of videoNodes) {
        const url = videoNode.getAttribute('src');
        const videoHtml = getVideoHtml(url);

        // Alignment for citation text
        let alignment = '';

        // Handle class attribute
        let classAttr = videoNode.getAttribute('class') || '';

        if (classAttr.includes('citation-left')) {
            alignment = 'left';
            classAttr = classAttr.replace('citation-left', '');
        } else if (classAttr.includes('citation-right')) {
            alignment = 'right';
            classAttr = classAttr.replace('citation-right', '');
        }

        // Ensure 'video' class is present
        if (!classAttr.includes('video')) {
            classAttr = `video ${classAttr}`;
        }

        // Set the modified class attribute
        videoNode.setAttribute('class', classAttr.replace(/\s+/g, ' ').trim());

        // Build attributes string (excluding src)
        let attributes = '';
        for (const [key, value] of Object.entries(videoNode.attributes)) {
            // eslint-disable-next-line no-continue
            if (key === 'src') { continue; }
            attributes += `${key}="${value}" `;
        }

        // Get inner HTML content
        const innerHTML = videoNode.innerHtml();

        // Prepare figcaption
        let figcaption = '';
        const figcaptionClass = alignment ? ` class="${alignment}"` : '';

        // Find cite node within this video node
        const citeNode = videoNode.querySelector('cite');

        if (citeNode && innerHTML.length > 0) {
            const citeHtml = citeNode.toHtml();
            const citeText = citeNode.innerHtml();
            const link = `<a href="${url}" target="_blank" rel="noreferrer">${citeText}</a>`;
            figcaption = `<figcaption${figcaptionClass}>${innerHTML.replace(citeHtml, link)}</figcaption>`;
        } else if (citeNode) {
            const citeText = citeNode.innerHtml();
            figcaption = `<figcaption${figcaptionClass}><a href="${url}" target="_blank" rel="noreferrer">${citeText}</a></figcaption>`;
        } else if (innerHTML.length > 0) {
            figcaption = `<figcaption${figcaptionClass}>${innerHTML}</figcaption>`;
        }

        // Create replacement HTML as a text node
        const replacementHtml = `<figure ${attributes.trim()}>${videoHtml}${figcaption}</figure>`;

        // Create new text node
        const textNode = scope.dom.createNode('text');
        textNode.content = replacementHtml;

        // Replace the original video node
        videoNode.replaceWith(textNode);
    }
};

export default jamsEduVideo;
