/**
 * Module-defined routes middleware
 * @module arpen/middleware/routes
 */

/**
 * Module-provided routes
 */
class Routes {
    /**
     * Create the service
     * @param {App} app                 The application
     * @param {object} express          Express app
     */
    constructor(app, express) {
        this._app = app;
        this._express = express;
    }

    /**
     * Service name is 'middleware.routes'
     * @type {string}
     */
    static get provides() {
        return 'middleware.routes';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'express' ];
    }

    /**
     * Register middleware
     * @return {Promise}
     */
    register() {
        return this._app.search(/^modules\.[^.]+$/).reduce(
            (prev, cur) => {
                let _module = this._app.get(cur);
                return prev.then(() => {
                    let result = _module.routes(this._express);
                    if (result === null || typeof result != 'object' || typeof result.then != 'function')
                        throw new Error(`Module '${cur}' routes() did not return a Promise`);
                    return result;
                });
            },
            Promise.resolve()
        );
    }
}

module.exports = Routes;