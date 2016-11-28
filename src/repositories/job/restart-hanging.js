/**
 * JobRepository.restartHanging()
 */
'use strict';

const WError = require('verror').WError;

/**
 * Restart jobs started by this server
 * @method restartHanging
 * @memberOf module:arpen/repositories/job~JobRepository
 * @param {PostgresClient} [reuseClient]    Postgres client to use (will create a new one otherwise)
 * @return {Promise}                        Resolves on success
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
                    'UPDATE jobs ' +
                    '   SET status = "pending" ' +
                    ' WHERE status = "running" ' +
                    '   AND started_by = $1 ',
                    [ this._config.instance ]
                )
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
            throw new WError(error, 'JobRepository.restartHanging()');
        });
};
