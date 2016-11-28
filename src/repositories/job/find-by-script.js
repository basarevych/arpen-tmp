/**
 * JobRepository.findByScript()
 */
'use strict';

const WError = require('verror').WError;

/**
 * Find jobs by script name
 * @method findByScript
 * @memberOf module:arpen/repositories/job~JobRepository
 * @param {string} script                   Script name to search by
 * @param {PostgresClient} [reuseClient]    Postgres client to use (will create a new one otherwise)
 * @return {Promise}                        Resolves to array of models
 */
module.exports = function (script, reuseClient) {
    return Promise.resolve()
        .then(() => {
            if (reuseClient)
                return reuseClient;

            return this._postgres.connect();
        })
        .then(client => {
            return client.query(
                    'SELECT * ' +
                    '  FROM jobs ' +
                    ' WHERE script = $1 ',
                    [ script ]
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
            throw new WError(error, 'JobRepository.findByScript()');
        });
};
