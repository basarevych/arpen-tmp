/**
 * JobRepository.find()
 */
'use strict';

const WError = require('verror').WError;

/**
 * Find a job by ID
 * @method find
 * @memberOf module:arpen/repositories/job~JobRepository
 * @param {number} id                       ID to search by
 * @param {PostgresClient} [reuseClient]    Postgres client to use (will create a new one otherwise)
 * @return {Promise}                        Resolves to array of models
 */
module.exports = function (id, reuseClient) {
    let key = `sql:jobs-by-id:${id}`;

    return this._cacher.get(key)
        .then(value => {
            if (value)
                return value;

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
                            ' WHERE id = $1 ',
                            [ id ]
                        )
                        .then(result => {
                            let rows = result.rowCount ? result.rows : [];
                            if (!rows.length)
                                return rows;

                            return this._cacher.set(key, rows)
                                .then(() => {
                                    return rows;
                                });
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
                });
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
            throw new WError(error, 'JobRepository.find()');
        });
};
