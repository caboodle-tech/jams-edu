/**
 * Author:  Christopher Keers | Caboodle Tech
 * License: MIT
 * Source:  https://gist.github.com/blizzardengle/8147b6e7d8ffab2709ae2f79b7006b02
 */
class Print {

    #enabled = true;

    clear() {
        console.clear();
    }

    disable() {
        this.#enabled = false;
    }

    enable() {
        this.#enabled = true;
    }

    error(message, override = false) {
        if (!this.#enabled && !override) {
            return;
        }
        // Red color
        console.error(this.#formatMessage(message, '\x1b[31m'));
    }

    #formatMessage(message, colorCode) {
        const resetCode = '\x1b[0m';
        return `${colorCode}${message}${resetCode}`;
    }

    info(message, override = false) {
        if (!this.#enabled && !override) {
            return;
        }
        // Cyan color
        console.log(this.#formatMessage(message, '\x1b[36m'));
    }

    log(message, override = false) {
        if (!this.#enabled && !override) {
            return;
        }
        // White color
        console.log(this.#formatMessage(message, '\x1b[37m'));
    }

    notice(message, override = false) {
        if (!this.#enabled && !override) {
            return;
        }
        // Blue color
        console.log(this.#formatMessage(message, '\x1b[94m'));
    }

    out(message, override = false) {
        this.print(message, override);
    }

    print(message, override = false) {
        if (!this.#enabled && !override) {
            return;
        }
        console.log(message);
    }

    success(message, override = false) {
        if (!this.#enabled && !override) {
            return;
        }
        // Green color
        console.log(this.#formatMessage(message, '\x1b[32m'));
    }

    warn(message, override = false) {
        if (!this.#enabled && !override) {
            return;
        }
        // Yellow color
        console.warn(this.#formatMessage(message, '\x1b[33m'));
    }

}

const printer = new Print();

export default printer;
