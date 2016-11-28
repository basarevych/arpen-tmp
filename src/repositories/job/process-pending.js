/**
 * JobRepository.processPending()
 */
'use strict';

const moment = require('moment-timezone');
const WError = require('verror').WError;

/**
 * Find next pending jobs for this server instance.<br>
 * Found jobs that are expired are marked so, rest are marked as started and returned. Processed jobs statuses in the
 * database are updated
 * @method processPending
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
            return client.transaction({ name: 'JobRepository.processPending' }, rollback => {
                    let returnValue = [], now = moment();

                    /**
                     * Process a job
                     * @param {JobModel} job                Job model instance
                     * @param {function} resolve            Associated Promise resolve function
                     * @param {function} reject             Associated Promise reject function
                     */
                    let processJob = (job, resolve, reject) => {
                        if (job.status == 'running' || (job.scheduleStart && now.isBefore(job.scheduleStart)))
                            return resolve();

                        let status = (job.scheduleEnd && now.isAfter(job.scheduleEnd)) ? 'expired' : 'running';
                        client.query(
                                'UPDATE jobs ' +
                                '   SET status = $1, ' +
                                '       started_at = $2, ' +
                                '       started_by = $3, ' +
                                '       finished_at = $4 ' +
                                ' WHERE id = $5 ',
                                [
                                    status,
                                    now,
                                    this._config.instance,
                                    status == 'running' ? null : now,
                                    job.id
                                ]
                            )
                            .then(() => {
                                if (status == 'running')
                                    returnValue.push(job);

                                resolve();
                            })
                            .catch(error => {
                                reject(error);
                            });
                    };

                    let promises = [];
                    return client.query(
                            '  SELECT * ' +
                            '    FROM jobs ' +
                            '   WHERE (target IS NULL OR target = $1) ' +
                            '     AND queue IS NULL ' +
                            '     AND status = "pending" ' +
                            '     AND (schedule_start IS NULL OR schedule_start <= $2) ' +
                            'ORDER BY created_at ASC',
                            [ this._config.instance, now ]
                        )
                        .then(result => {
                            if (result.rowCount) {
                                result.rows.forEach(row => {
                                    let job = this._app.get('models.job');
                                    this._postgres.constructor.unserializeModel(job, row);

                                    promises.push(new Promise((resolve, reject) => {
                                        processJob(job, resolve, reject);
                                    }));
                                });
                            }

                            return client.query(
                                '  SELECT DISTINCT queue AS queue ' +
                                '    FROM jobs ' +
                                '   WHERE (target IS NULL OR target = $1) ' +
                                '     AND queue IS NOT NULL ' +
                                '     AND status = "pending" ' +
                                '     AND (schedule_start IS NULL OR schedule_start <= $2) ',
                                [ this._config.instance, now ]
                            );
                        })
                        .then(queueResult => {
                            if (queueResult.rowCount) {
                                queueResult.rows.forEach(queueRow => {
                                    promises.push(new Promise((resolve, reject) => {
                                        client.query(
                                                '  SELECT count(*)::int AS count ' +
                                                '    FROM jobs ' +
                                                '   WHERE (target IS NULL OR target = $1) ' +
                                                '     AND queue = $2 ' +
                                                '     AND status = "running" ',
                                                [ this._config.instance, queueRow.queue ]
                                            )
                                            .then(countResult => {
                                                if (countResult.rows[0].count > 0) {
                                                    resolve();
                                                } else {
                                                    return client.query(
                                                            '  SELECT * ' +
                                                            '    FROM jobs ' +
                                                            '   WHERE (target IS NULL OR target = $1) ' +
                                                            '     AND queue = $2 ' +
                                                            '     AND status = "pending" ' +
                                                            '     AND (schedule_start IS NULL OR schedule_start <= $3) ' +
                                                            'ORDER BY created_at ASC ' +
                                                            '   LIMIT 1 ',
                                                            [ this._config.instance, queueRow.queue, now ]
                                                        )
                                                        .then(jobResult => {
                                                            if (!jobResult.rowCount)
                                                                return reject(new Error('Empty result when data expected'));

                                                            let job = this._app.get('models.job');
                                                            this._postgres.constructor.unserializeModel(job, jobResult.rows[0]);
                                                            processJob(job, resolve, reject);
                                                        });
                                                }
                                            })
                                            .catch(error => {
                                                reject(error);
                                            });
                                    }));
                                });
                            }

                            if (!promises.length)
                                return rollback(returnValue);

                            return Promise.all(promises)
                                .then(() => {
                                    return returnValue;
                                });
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
        })
        .catch(error => {
            throw new WError(error, 'JobRepository.processPending()');
        });
};
