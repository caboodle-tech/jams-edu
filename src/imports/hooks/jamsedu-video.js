/* eslint-disable no-param-reassign */
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
 *
 * @param {string} url The URL of the video.
 * @returns {string} The HTML code for embedding the video.
 */
const getVideoHtml = (url) => {

    if (url.includes('dai.ly')) {
        const urlObj = parseUrl(url);
        const videoId = urlObj.urlParts[urlObj.urlParts.length - 1];
        return `<iframe frameborder="0" type="text/html" src="https://www.dailymotion.com/embed/video/${videoId}" allowfullscreen title="Dailymotion Video Player" ></iframe>`;
    }

    if (url.includes('rumble')) {
        const urlObj = parseUrl(url);
        const videoId = urlObj.urlParts[urlObj.urlParts.length - 1];
        return `<iframe src="https://rumble.com/embed/${videoId}/" frameborder="0" allowfullscreen></iframe>`;
    }

    if (url.includes('twitch')) {
        const urlObj = parseUrl(url);
        const videoId = urlObj.urlParts[urlObj.urlParts.length - 1];
        return `<iframe src="https://player.twitch.tv/?video=${videoId}&parent=${urlObj.params.parent}" frameborder="0" allowfullscreen="true" scrolling="no"></iframe>`;
    }

    if (url.includes('vimeo')) {
        const urlObj = parseUrl(url);
        const videoId = urlObj.urlParts[urlObj.urlParts.length - 1];

        let parameters = '';
        ['title', 'byline', 'portrait', 'badge'].forEach((param) => {
            if (urlObj.params[param]) {
                parameters += `&${param}=${urlObj.params[param]}`;
            }
        });

        if (parameters.length > 0) {
            parameters = `?${parameters.slice(1)}`;
        }

        return `<iframe frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen src="https://player.vimeo.com/video/${videoId}${parameters}"></iframe>`;
    }

    if (url.includes('youtu')) {
        const urlObj = parseUrl(url);

        let videoId = urlObj.urlParts[urlObj.urlParts.length - 1];
        if (!videoId && urlObj.params.v) {
            videoId = urlObj.params.v;
        }

        let parameters = '?modestbranding=1';

        if (urlObj.params.t || urlObj.params.start) {
            parameters += `&start=${urlObj.params.t || urlObj.params.start}`;
        }

        return `<iframe allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" frameborder="0" sandbox="allow-scripts allow-same-origin" src="https://www.youtube-nocookie.com/embed/${videoId}${parameters}"></iframe>`;
    }

    return `<iframe src="${url}" frameborder="0" allowfullscreen></iframe>`;
};

/**
 * Converts video elements in the given HTML to video figures with embedded videos.
 *
 * @param {string} html The HTML content to process.
 * @param {object} som The object representing the HTML structure.
 * @returns {string} The modified HTML content with embedded videos.
 */
const JamsEduVideo = (html, som) => {
    som.findAll('video[src]').forEach((node) => {
        const url = node.value.attrsMap.get('src');
        const videoHtml = getVideoHtml(url);
        const originalHtml = som.getNodeHtml(node);
        const innerHTML = som.getNodeInnerHtml(node).trim();

        // Alignment for citation text.
        let alignment = '';

        // Ensure the class attribute is set and starts with the `video` class.
        if (node.value.attrsMap.has('class')) {
            if (node.value.attrsMap.get('class').includes('citation-left')) {
                alignment = 'left';
                node.value.attrsMap.set('class', node.value.attrsMap.get('class').replace('citation-left', ''));
            } else if (node.value.attrsMap.get('class').includes('citation-right')) {
                alignment = 'right';
                node.value.attrsMap.set('class', node.value.attrsMap.get('class').replace('citation-right', ''));
            }
            const classAttr = node.value.attrsMap.get('class').trim().replace(/\s+/g, ' ');
            node.value.attrsMap.set('class', `video ${classAttr}`);
        } else {
            node.value.attrsMap.set('class', 'video');
        }

        // Keep any attributes other than the src attribute the user has set.
        let attributes = '';
        node.value.attrsMap.forEach((value, key) => {
            // Skip the src attribute.
            if (key === 'src') { return; }
            attributes += `${key}="${value}" `;
        });

        // Prepare the figcaption parts.
        let figcaption = '';
        let figcaptionClass = '';

        if (alignment) {
            figcaptionClass = ` class="${alignment}"`;
        }

        // Generate the figcaption.
        const citeNode = som.find('cite', node);
        if (citeNode.key && innerHTML.length > 0) {
            const citeHtml = som.getNodeHtml(citeNode);
            const citeText = som.getNodeInnerHtml(citeNode);
            const link = `<a href="${url}" target="_blank" rel="noreferrer">${citeText}</a>`;
            figcaption = `<figcaption${figcaptionClass}>${innerHTML.replace(citeHtml, link)}</figcaption>`;
        } else if (citeNode.key) {
            const citeText = som.getNodeInnerHtml(citeNode);
            figcaption = `<figcaption${figcaptionClass}><a href="${url}" target="_blank" rel="noreferrer">${citeText}</a></figcaption>`;
        } else if (innerHTML.length > 0) {
            figcaption = `<figcaption${figcaptionClass}>${innerHTML}</figcaption>`;
        }

        html = html.replace(originalHtml, `<figure ${attributes.trim()}>${videoHtml}${figcaption}</figure>`);
    });

    return html;
};

export default JamsEduVideo;
