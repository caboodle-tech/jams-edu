/**
 * JamsEdu uses a special comment header (Compiler Directive) in files requiring compiling to
 * indicate what settings to compile the file with. This Rollup plugin will remove that comment from
 * the file if it is present in the transformed (output) code.
 *
 * NOTE: This also handles removing comments from json files allowing the `--keep` option to be
 * used in json which normally does not allow comments.
 */

const Regex = {
    allComments: /\/\/.*|\/\*[\s\S]*?\*\//g,
    compilerDirective: /\/\/.*@jamsedu.*(\r?\n)?|\/\*[\s\S]*?@jamsedu[\s\S]*?\*\//g
};

export default () => ({
    name: 'jamsedu-remove-header-comment',
    transform(code, id) {
        let transformedCode = code;

        // Remove comments from json files, this allows the `--keep` flag to be set for json files.
        if (id.endsWith('.json')) {
            transformedCode = transformedCode.replace(Regex.allComments, '');
        }

        // Remove the compiler directive (header comment) entirely along with the newline after it.
        transformedCode = transformedCode.replace(Regex.compilerDirective, '');

        return {
            code: transformedCode,
            map: null
        };
    }
});

export const ManuallyRemoveAllComments = (code) => {
    // Remove all comments entirely.
    const transformedCode = code.replace(Regex.allComments, '');
    return transformedCode.trimStart();
};

export const ManuallyRemoveJamsEduHeaderComment = (code) => {
    // Remove the compiler directive (header comment) entirely along with the newline after it.
    const transformedCode = code.replace(Regex.compilerDirective, '');
    return transformedCode.trimStart();
};
