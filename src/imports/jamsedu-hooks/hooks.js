import jamsEduBlockquotes from './blockquotes.js';
import jamsEduExternalLinks from './external-links.js';
import jamsEduVideo from './videos.js';

export default {
    pre: [],
    post: [jamsEduBlockquotes, jamsEduExternalLinks, jamsEduVideo]
};
