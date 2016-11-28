/**
 * JobRepository.findAll()
 */
'use strict';

const WError = require('verror').WError;

/**
 * Find all jobs
 * @method findAll
 * @memberOf module:arpen/repositories/job~JobRepository
 * @param {PostgresClient} [reuseClient]    Postgres client to use (will create a new one otherwise)
 * @return {Promise}                        Resolves to array of models
 */
module.exports = function (reuseClient) {
    return Promise.resolve()
        .then(() => {
            if (reuseClient)
                return reuseClient;

            return this._postgres.connect();
        })
        .then(client => {
            return client.query(
                    'SELECT * ' +
                    '  FROM jobs ',
                    []
                )
                .then(result => {
                    return result.rowCount ? result.rows : [];
                })
                .then(
                    value => {
                        if (!reuseClient)
                            client.done();
                        return value;
                    },
                    error => {
                        if (!reuseClient)
                            client.done();
                        throw error;
                    }
                );
        })
        .then(rows => {
            let jobs = [];
            for (let row of rows) {
                let job = this._app.get('models.job');
                this._postgres.constructor.unserializeModel(job, row);
                jobs.push(job);
            }

            return jobs;
        })
        .catch(error => {
            throw new WError(error, 'JobRepository.findAll()');
        });
};
