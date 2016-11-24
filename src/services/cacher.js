/**
 * Cache service
 * @module arpen/services/cacher
 */
const debug = require('debug')('arpen:cacher');
const WError = require('verror').WError;

/**
 * Cacher
 */
class Cacher {
    /**
     * Create the service
     * @param {object} config                   Configuration
     * @param {Redis} redis                     Redis service
     * @param {Logger} logger                   Logger service
     * @param {Util} util                       Util service
     */
    constructor(config, redis, logger, util) {
        this._config = config;
        this._redis = redis;
        this._logger = logger;
        this._util = util;
    }

    /**
     * Service name is 'cacher'
     * @type {string}
     */
    static get provides() {
        return 'cacher';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'config', 'redis', 'logger', 'util' ];
    }

    /**
     * Set variable to a new value
     * @param {string} name                     The name
     * @param {*} value                         The value
     * @param {number} [ttl]                    Time before expiration is seconds, use 0 to store forever.
     *                                          If undefined then default (random) value will be used
     * @return {Promise}                        Resolves on success
     */
    set(name, value, ttl) {
        value = JSON.stringify(value);
        if (Buffer.byteLength(value) > 512 * 1024 * 1024)
            return Promise.reject(new Error(`Cache overflow for ${name}`));

        if (typeof ttl == 'undefined')
            ttl = this._util.getRandomInt(this._config.get('cache.expire_min'), this._config.get('cache.expire_max'));

        return this._redis.connect(this._config.get('cache.redis'))
            .then(client => {
                debug(`Setting ${name}`);
                return client.query('SET', [ this._getKey(name), value ])
                    .then(() => {
                        if (ttl)
                            return client.query('EXPIRE', [ this._getKey(name), ttl ]);
                    })
                    .then(
                        value => {
                            client.done();
                            return value;
                        },
                        error => {
                            client.done();
                            throw error;
                        }
                    );
            })
            .catch(error => {
                if (this._config.get('cache.ignore_errors'))
                    this._logger.warn('Cacher.set() - Redis error (ignoring)', error);
                else
                    throw new WError(error, 'Cacher.set()');
            });
    }

    /**
     * Get variable value refreshing its lifetime
     * @param {string} name                     The name
     * @param {number} [ttl]                    Time before expiration is seconds, use 0 to store forever.
     *                                          If undefined then default (random) value will be used
     * @return {Promise}                        Resolves to variable value or undefined
     */
    get(name, ttl) {
        if (typeof ttl == 'undefined')
            ttl = this._util.getRandomInt(this._config.get('cache.expire_min'), this._config.get('cache.expire_max'));

        return this._redis.connect(this._config.get('cache.redis'))
                .then(client => {
                    return client.query('GET', [ this._getKey(name) ])
                        .then(result => {
                            if (result === null) {
                                debug(`Missed ${name}`);
                                return undefined;
                            }

                            debug(`Getting ${name}`);
                            return client.query('EXPIRE', [ this._getKey(name), ttl ])
                                .then(result => {
                                    return JSON.parse(result);
                                });
                        })
                        .then(
                            value => {
                                client.done();
                                return value;
                            },
                            error => {
                                client.done();
                                throw error;
                            }
                        );
                })
                .catch(error => {
                    if (this._config.get('cache.ignore_errors'))
                        this._logger.warn('Cacher.get() - Redis error (ignoring)', error);
                    else
                        throw new WError(error, 'Cacher.get()');
                });
    }

    /**
     * Remove variable
     * @param {string} name                     The name
     * @return {Promise}                        Resolves on success
     */
    unset(name) {
        return this._redis.connect(this._config.get('cache.redis'))
                .then(client => {
                    return client.query('EXISTS', [ this._getKey(name) ])
                        .then(result => {
                            if (!result)
                                return;

                            debug(`Unsetting ${name}`);
                            return client.query('DEL', [ this._getKey(name) ]);
                        })
                        .then(
                            value => {
                                client.done();
                                return value;
                            },
                            error => {
                                client.done();
                                throw error;
                            }
                        );
                })
                .catch(error => {
                    if (this._config.get('cache.ignore_errors'))
                        this._logger.warn('Cacher.unset() - Redis error (ignoring)', error);
                    else
                        throw new WError(error, 'Cacher.unset()');
                });
    }

    /**
     * Convert variable name to Redis key
     * @param {string} name                         Cache variable name
     * @return {string}                             Returns corresponding Redis key
     */
    _getKey(name) {
        return `${this._config.project}:${this._config.instance}:cache:${name}`;
    }
}

module.exports = Cacher;
