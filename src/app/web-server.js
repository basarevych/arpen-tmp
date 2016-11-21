/**
 * Web application
 * @module arpen/app/web-server
 */
const debug = require('debug')('arpen:app');
const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const App = require('./base');
const WError = require('verror').WError;

/**
 * Web server application class
 * @extends module:arpen/app/base~App
 */
class WebServer extends App {
    /**
     * Initialize the app
     * @return {Promise}
     */
    init() {
        return super.init()
            .then(() => {
                let config = this.get('config');

                let exp = express();
                this.registerInstance(exp, 'express');

                debug('Initializing express');
                exp.set('env', config.get('env'));
                let options = config.get('web_server.express');
                for (let option of Object.keys(options)) {
                    let name = option.replace('_', ' ');
                    let value = options[option];
                    exp.set(name, value);
                }

                let views = [];
                for (let _module of config.modules) {
                    for (let view of _module.views) {
                        let filename = view[0] == '/' ?
                            view :
                            path.join(__dirname, '..', '..', 'modules', _module.name, view);
                        views.push(filename);
                    }
                }
                exp.set('views', views);

                debug('Loading middleware');
                let middlewareConfig = config.get('middleware');
                if (!Array.isArray(middlewareConfig))
                    return;

                let loadedMiddleware = new Map();
                this.registerInstance(loadedMiddleware, 'middleware');

                return middlewareConfig.reduce(
                    (prev, cur) => {
                        return prev.then(() => {
                            let middleware = this.get(cur);
                            loadedMiddleware.set(cur, middleware);

                            debug(`Registering middleware ${cur}`);
                            return middleware.register();
                        });
                    },
                    Promise.resolve()
                );
            })
            .then(() => {
                let config = this.get('config');
                let filer = this.get('filer');
                let exp = this.get('express');

                if (!config.get('web_server.ssl.enable'))
                    return http.createServer(exp);

                let promises = [
                    filer.lockReadBuffer(config.get('web_server.ssl.key')),
                    filer.lockReadBuffer(config.get('web_server.ssl.cert')),
                ];
                if (config.get('web_server.ssl.ca'))
                    promises.push(filer.lockReadBuffer(config.get('web_server.ssl.ca')));

                return Promise.all(promises)
                    .then(([key, cert, ca]) => {
                        let options = {
                            key: key,
                            cert: cert,
                        };
                        if (ca)
                            options.ca = ca;

                        return https.createServer(options, exp);
                    });
            })
            .then(server => {
                this.registerInstance(server, 'http');
            });
    }

    /**
     * Start the app
     * @return {Promise}
     */
    start() {
        return super.start()
            .then(() => {
                debug('Starting the server');
                let config = this.get('config');
                let server = this.get('http');
                let port = this._normalizePort(config.get('web_server.port'));

                server.listen(port, typeof port == 'string' ? undefined : config.get('web_server.host'));
                server.on('error', this.onError.bind(this));
                server.on('listening', this.onListening.bind(this));

                let user = config.get('web_server.user');
                if (user) {
                    process.setgid(user.gid);
                    process.setuid(user.uid);
                }
            })
            .then(() => {
                this._running = true;
            });
    }

    /**
     * Error handler
     * @param {object} error            The error
     */
    onError(error) {
        let logger = this.get('logger');
        if (error.syscall !== 'listen')
            return logger.error(new WError(error, 'WebServer.onError()'));

        switch (error.code) {
            case 'EACCES':
                logger.error('Port requires elevated privileges');
                break;
            case 'EADDRINUSE':
                logger.error('Port is already in use');
                break;
            default:
                logger.error(error);
        }
        process.exit(1);
    }

    /**
     * Listening event handler
     */
    onListening() {
        let logger = this.get('logger');
        let config = this.get('config');
        let port = this._normalizePort(config.get('web_server.port'));
        logger.info(
            (config.get('web_server.ssl.enable') ? 'HTTPS' : 'HTTP') +
            ' server listening on ' +
            (typeof port == 'string' ?
                port :
            config.get('web_server.host') + ':' + port)
        );
    }

    /**
     * Normalize port parameter
     * @param {string|number} val           Port value
     * @return {*}
     */
    _normalizePort(val) {
        let port = parseInt(val, 10);
        if (isNaN(port))
            return val;
        if (port >= 0)
            return port;
        return false;
    }
}

module.exports = WebServer;