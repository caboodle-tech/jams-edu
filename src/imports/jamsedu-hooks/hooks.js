import jamsEduVideo from './videos.js';
import jamsTables from './tables.js';
import {
    rootRelativeToRelativeUrls,
    removeAllComments,
    removeEmptyLines
} from './common.js';

export default {
    pre: [
        removeAllComments
    ],
    post: [
        jamsEduVideo,
        jamsTables,
        rootRelativeToRelativeUrls,
        removeEmptyLines
    ]
};
