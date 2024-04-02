/* eslint-disable no-console */

class Print {

    #enabled = true;

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
