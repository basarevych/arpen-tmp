/**
 * JobRepository.search()
 */
'use strict';

const moment = require('moment-timezone');

/**
 * Find jobs by query
 * @method search
 * @memberOf module:arpen/repositories/job~JobRepository
 * @param {object} [options]                Base Repository.search() options
 * @param {PostgresClient} [reuseClient]    Postgres client to use (will create a new one otherwise)
 * @return {Promise}                        Resolves to sanitized base Repository.search() result (dates are converted
 *                                          to a number of milliseconds since Epoch)
 */
module.exports = function (options, reuseClient) {
    return super.search(
            'jobs',
            [
                'id',
                'status',
                'queue',
                'script',
                'target',
                'schedule_start',
                'schedule_end',
                'created_at',
                'created_by',
                'started_at',
                'started_by',
                'finished_at',
            ],
            options,
            reuseClient
        )
        .then(result => {
            for (let row of result.data) {
                for (let field of Object.keys(row)) {
                    let value = row[field];
                    if (value instanceof Date) {
                        let utcMoment = moment(value); // db field is in UTC
                        row[field] = moment.tz(utcMoment.format(this._postgres.constructor.datetimeFormat), 'UTC').valueOf();
                    }
                }
            }
            return result;
        });
};
