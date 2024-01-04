/* eslint-disable no-console */

class Print {

    static formatMessage(message, colorCode) {
        const resetCode = '\x1b[0m';
        return `${colorCode}${message}${resetCode}`;
    }

    static log(message) {
        // White color
        console.log(Print.formatMessage(message, '\x1b[37m'));
    }

    static success(message) {
        // Green color
        console.log(Print.formatMessage(message, '\x1b[32m'));
    }

    static warn(message) {
        // Yellow color
        console.warn(Print.formatMessage(message, '\x1b[33m'));
    }

    static error(message) {
        // Red color
        console.error(Print.formatMessage(message, '\x1b[31m'));
    }

}

export default Print;
