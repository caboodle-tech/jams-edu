/**
 * This file is responsible for defining the default compilers used by JamsEdu and providing a means
 * for the user to set their own compilers. We wrap all functions in an async function to ensure the
 * same format is used for all compilers.
 */
import Javascript from './compilers/javascript.js';
import Print from './print.js';
import Sass from './compilers/sass.js';
import Typescript from './compilers/typescript.js';

const SRC_INDEX = 0;
let isProgramInVerboseMode = false;

/**
 * Ensure all compilers are treated as async functions and print any errors according
 * to the users configured preference.
 */
const ensureCompilersAreAsync = (compiler, ...args) => Promise.resolve(compiler(...args))
    .then(() => true)
    .catch((error) => {
        Print.error(`Error compiling file: ${args[SRC_INDEX]}`);
        if (isProgramInVerboseMode) {
            Print.error(error);
        }
        return false;
    });

// Define the compile functions by wrapping them in an async function.
const compileJavascript = async(...args) => ensureCompilersAreAsync(Javascript, ...args);
const compileSass = async(...args) => ensureCompilersAreAsync(Sass, ...args);
const compileTypescript = async(...args) => ensureCompilersAreAsync(Typescript, ...args);

/**
 * Export the default compilers and the necessary functions to set verbose mode and wrap user
 * compilers in JamsEdu's expected format.
 */
export default {
    defaultCompilers: () => ({
        javascript: compileJavascript,
        sass: compileSass,
        scss: compileSass,
        typescript: compileTypescript
    }),
    setVerboseMode: (verbose = false) => { isProgramInVerboseMode = verbose; },
    wrapUserCompiler: (usersCompiler) => async(...args) => ensureCompilersAreAsync(usersCompiler, ...args)
};
