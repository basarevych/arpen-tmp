/**
 * Logger service
 * @module base/services/logger
 */
const VError = require('verror');
const WError = VError.WError;

/**
 * Logger service
 */
class Logger {
    /**
     * Create the service
     * @param {object} config       Config service
     * @param {Emailer} [emailer]   Emailer service if available
     */
    constructor(config, emailer) {
        this._config = config;
        this._emailer = emailer;
    }

    /**
     * Service name is 'logger'
     * @type {string}
     */
    static get provides() {
        return 'logger';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'config', 'emailer?' ];
    }

    /**
     * Log error
     * @param {...*} messages       Messages
     */
    error(...messages) {
        this.log('error', messages);
    }

    /**
     * Log info
     * @param {...*} messages       Messages
     */
    info(...messages) {
        this.log('info', messages);
    }

    /**
     * Log warning
     * @param {...*} messages       Messages
     */
    warn(...messages) {
        this.log('warn', messages);
    }

    /**
     * Actually log the error
     * @param {string} type         Type of the error message
     * @param [*[]] messages        Array of messages
     */
    log(type, messages) {
        let flat = [];
        for (let msg of messages) {
            if (msg instanceof WError) {
                flat.push('Exception data: ' + JSON.stringify(VError.info(msg), undefined, 4));
                flat = flat.concat(this.flattenWError(msg));
            } else {
                flat.push(msg);
            }
        }

        let lines = [], first = true;
        for (let msg of flat) {
            let prefix = '';
            if (first)
                first = false;
            else
                prefix = '  ';

            if (!(msg instanceof Error)) {
                lines.push(prefix + (typeof msg == 'object' ? JSON.stringify(msg) : msg));
                continue;
            }

            if (msg.stack)
                lines.push(prefix + msg.stack);
            else
                lines.push(prefix + msg.message);
        }

        let logFunc, logString, emailLog;
        switch (type) {
            case 'info':
                logFunc = 'log';
                logString = this.formatString(lines.join("\n"));
                emailLog = false;
                break;
            case 'warn':
                logFunc = 'log';
                logString = this.formatString(lines.join("\n"));
                emailLog = this._config.get('email.logger.warn_enable');
                break;
            case 'error':
                logFunc = 'error';
                logString = this.formatString(lines.join("\n"));
                emailLog = this._config.get('email.logger.error_enable');
                break;
            default:
                throw new Error(`Invalid type: ${type}`);
        }

        console[logFunc](logString);

        if (!emailLog || !this._emailer)
            return;

        this._emailer.send({
            to: this._config.get('email.logger.to'),
            from: this._config.get('email.from'),
            subject: '[' + this._config.project + '] Message logged (' + type + ')',
            text: logString,
        });
    }

    /**
     * Flatten WError instance
     * @param {object} err          WError with possible previous errors set
     * @return {object[]}           Returns array of all the errors
     */
    flattenWError(err) {
        let result = [ err ];
        if (!err.cause)
            return result;

        return result.concat(this.flattenWError(err.cause()));
    }

    /**
     * Format a log string
     * @param {string} string       String to log
     * @return {string}             Returns the string with date
     */
    formatString(string) {
        function padZero(number) {
            let output = String(number);
            if (output.length == 1)
                output = '0' + output;
            return output;
        }

        let date = new Date();
        let dateString = date.getFullYear() + '-' + padZero(date.getMonth()+1) + '-' + padZero(date.getDate());
        dateString += ' ' + padZero(date.getHours()) + ':' + padZero(date.getMinutes()) + ':' + padZero(date.getSeconds());

        return "[" + dateString + "] " + string;
    }
}

module.exports = Logger;
