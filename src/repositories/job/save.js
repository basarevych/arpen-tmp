/**
 * JobRepository.save()
 */
'use strict';

const WError = require('verror').WError;

/**
 * Save job
 * @method save
 * @param {JobModel} job                    Job model
 * @param {PostgresClient} [reuseClient]    Postgres client to use (will create a new one otherwise)
 * @return {Promise}                        Resolves to record ID
 * @memberOf module:arpen/repositories/job~JobRepository
 */
module.exports = function (job, reuseClient) {
    return Promise.resolve()
        .then(() => {
            if (reuseClient)
                return reuseClient;

            return this._postgres.connect();
        })
        .then(client => {
            return Promise.resolve()
                .then(() => {
                    let data = this._postgres.constructor.serializeModel(job);
                    let fields = Object.keys(data)
                        .filter(field => {
                            return field != 'id';
                        });

                    let query, params = [];
                    if (job.id) {
                        query = 'UPDATE jobs SET ';
                        query += fields
                            .map(field => {
                                params.push(data[field]);
                                return `${field} = $${params.length}`;
                            })
                            .join(', ');
                        params.push(data.id);
                        query += ` WHERE id = ${params.length}`;
                    } else {
                        query = 'INSERT INTO jobs(';
                        query += fields.join(', ');
                        query += ') VALUES (';
                        query += fields
                            .map(field => {
                                params.push(data[field]);
                                return `$${params.length}`;
                            })
                            .join(', ');
                        query += ')';
                    }
                    query += ' RETURNING id';
                    return client(query, params);
                })
                .then(result => {
                    let id = (result.rowCount && result.rows[0].id) || null;
                    if (!id)
                        throw new Error('Unexpected error: no ID');

                    job.id = id;
                    job._dirty = false;
                    return id;
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
        .catch(error => {
            throw new WError(error, 'JobRepository.save()');
        });
};
