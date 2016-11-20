/**
 * Error handling middleware
 * @module arpen/middleware/error
 */

/**
 * Error handler
 */
class ErrorHandler {
    /**
     * Create the service
     * @param {object} config           Configuration
     * @param {object} express          Express app
     */
    constructor(config, express) {
        this._config = config;
        this._express = express;
    }

    /**
     * Service name is 'middleware.errorHandler'
     * @type {string}
     */
    static get provides() {
        return 'middleware.errorHandler';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'config', 'express' ];
    }

    /**
     * Register middleware
     * @return {Promise}
     */
    register() {
        this._express.use((req, res, next) => {
            let err = new Error('Not Found');
            err.status = 404;
            next(err);
        });
        this._express.use((err, req, res, next) => {
            res.locals.message = err.message;
            res.locals.error = this._config.get('env') === 'development' ? err : {};
            res.status(err.status || 500);
            res.render('error');
        });

        return Promise.resolve();
    }
}

module.exports = ErrorHandler;