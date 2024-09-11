/**
 * Converts Markdown text to terminal formatted text designed to mimic a man page.
 */
class MarkdownToTerminal {

    /**
     * Parses the given Markdown text and returns the terminal formatted text.
     *
     * @param {string} markdown The Markdown text to parse.
     * @returns {string} The terminal formatted text.
     */
    parse(markdown) {
        const lines = markdown.split('\n');
        const parsedLines = lines.map((line) => this.parseLine(line));
        return parsedLines.join('\n');
    }

    /**
     * Parses inline code blocks in a line of Markdown text and returns the colorized text.
     *
     * @param {string} line The line of Markdown text to parse.
     * @returns {string} The terminal formatted line.
     */
    parseInlineCode(line) {
        return line.replace(/`([^`]+)`/g, '\x1b[33m$1\x1b[0m');
    }

    /**
     * Parses a single line of Markdown text and returns the terminal formatted line.
     *
     * @param {string} line The line of Markdown text to parse.
     * @returns {string} The terminal formatted line.
     */
    parseLine(line) {
        let newLine = this.parseBold(line);
        newLine = this.parseHeaders(newLine);
        newLine = this.parseInlineCode(newLine);
        newLine = this.parseLinks(newLine);
        return newLine;
    }

    /**
     * Parses bold formatting in a line of Markdown text and returns the bold formatted text.
     *
     * @param {string} line The line of Markdown text to parse.
     * @returns {string} The terminal formatted line.
     */
    parseBold(line) {
        return line.replace(/\*\*(.*?)\*\*/g, '\x1b[1m$1\x1b[0m');
    }

    /**
     * Parses headers in a line of Markdown text and returns bold and uppercase text.
     *
     * @param {string} line The line of Markdown text to parse.
     * @returns {string} The terminal formatted line.
     */
    parseHeaders(line) {
        return line.replace(/^(#{1,6})\s*(.*)/, (match, hashes, text) => `\x1b[1m${text.toUpperCase()}\x1b[0m`);
    }

    /**
     * Parses links in a line of Markdown text and returns the text underlined with the link in
     * parentheses.
     *
     * @param {string} line The line of Markdown text to parse.
     * @returns {string} The terminal formatted line.
     */
    parseLinks(line) {
        return line.replace(/\[([^\]]+)]\(([^)]+)\)/g, '\x1b[4m$1\x1b[0m (\x1b[36m$2\x1b[0m)');
    }

}

export default new MarkdownToTerminal();
