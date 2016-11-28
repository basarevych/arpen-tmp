/**
 * JobRepository.delete()
 */
'use strict';

const WError = require('verror').WError;

/**
 * Delete a job
 * @method delete
 * @param {JobModel} job                    Job model
 * @param {PostgresClient} [reuseClient]    Postgres client to use (will create a new one otherwise)
 * @return {Promise}                        Resolves to number of deleted records
 * @this JobRepository
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
            return client.query(
                    'DELETE ' +
                    '  FROM jobs ' +
                    ' WHERE id = $1 ',
                    [ job.id ]
                )
                .then(result => {
                    return result.rowCount;
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
            throw new WError(error, 'JobRepository.delete()');
        });
};
