/**
 * Job repository
 * @module arpen/repositories/job
 */
const path = require('path');
const Repository = require('./base');

/**
 * Job repository class
 */
class JobRepository extends Repository {
    /**
     * Create repository
     * @param {App} app                             The application
     * @param {object} config                       Configuration service
     * @param {Postgres} postgres                   Postgres service
     * @param {Cacher} cacher                       Cacher service
     * @param {Util} util                           Util service
     */
    constructor(app, config, postgres, cacher, util) {
        super(app, postgres, util);
        this._config = config;
        this._cacher = cacher;

        this._loadMethods(path.join(__dirname, 'job'));
    }

    /**
     * Service name is 'repositories.job'
     * @type {string}
     */
    static get provides() {
        return 'repositories.job';
    }

    /**
     * Dependencies as constructor arguments
     * @type {string[]}
     */
    static get requires() {
        return [ 'app', 'config', 'postgres', 'cacher', 'util' ];
    }
}

module.exports = JobRepository;
