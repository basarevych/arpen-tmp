/**
 * Base class for repositories
 * @module arpen/repositories/base
 */
const path = require('path');
const fs = require('fs-ext');
const WError = require('verror').WError;

/**
 * Repository base class
 */
class Repository {
    /**
     * Create repository
     * @param {App} app                             The application
     * @param {Postgres} postgres                   Postgres service
     * @param {Util} util                           Util service
     */
    constructor(app, postgres, util) {
        this._app = app;
        this._postgres = postgres;
        this._util = util;
    }

    /**
     * Search repository
     * @param {string} table                        Table or view name
     * @param {string[]} fields                     Fields to retrieve
     * @param {object} [options]
     * @param {string[]} [options.where]            SQL WHERE clause: will be joined with 'AND'
     * @param {Array} [options.params]              Bound parameters (referenced as $1, $2, ... in SQL)
     * @param {string} [options.sortKey=null]       Used in ORDER BY if provided
     * @param {string} [options.sortOrder='asc']    Used in ORDER BY if provided with sort_key
     * @param {number} [options.pageSize=0]         Used in LIMIT, 0 = all records
     * @param {number} [options.pageNumber=1]       Used in OFFSET
     * @param {PostgresClient} [reuseClient]        Postgres client to use (will create a new one otherwise)
     * @return {Promise}                            Returns promise resolving to the following:
     * <pre>
     * {
     *      totalRows: 1, // total rows in result
     *      totalPages: 1, // total number of pages
     *      pageSize: 0, // page size
     *      pageNumber: 1, // returned page number
     *      sortKey: null, // key used to sort
     *      sortOrder: 'asc', // sort order
     *      data: [ ... ], // resulting rows as array
     * }
     * </pre>
     */
    search(
        table,
        fields,
        {
            where = [],
            params = [],
            sortKey = null,
            sortOrder = 'asc',
            pageSize = 0,
            pageNumber = 1
        } = {},
        reuseClient = null
    ) {
        return Promise.resolve()
            .then(() => {
                if (reuseClient)
                    return reuseClient;

                return this._postgres.connect();
            })
            .then(client => {
                return client.query(
                        'SELECT count(*)::int AS count ' +
                        `  FROM ${table} ` +
                        (where.length ? ' WHERE ' + where.join(' AND ') : ''),
                        params
                    )
                    .then(result => {
                        let totalRows = result.rowCount ? result.rows[0].count : 0;
                        let totalPages;
                        if (totalRows === 0 || pageSize === 0) {
                            totalPages = 1;
                            pageNumber = 1;
                        } else {
                            totalPages = Math.floor(totalRows / pageSize) + (totalRows % pageSize ? 1 : 0);
                            if (pageNumber > totalPages)
                                pageNumber = totalPages;
                        }

                        let offset = (pageNumber - 1) * pageSize;
                        return client.query(
                                'SELECT ' + fields.join(', ') +
                                `  FROM ${table} ` +
                                (where.length ? ' WHERE ' + where.join(' AND ') : '') +
                                (sortKey ? ` ORDER BY ${sortKey} ${sortOrder}` : '') +
                                (offset > 0 ? ` OFFSET ${offset} ` : '') +
                                (pageSize > 0 ? ` LIMIT ${pageSize} ` : ''),
                                params
                            )
                            .then(result => {
                                return {
                                    totalRows: totalRows,
                                    totalPages: totalPages,
                                    pageSize: pageSize,
                                    pageNumber: pageNumber,
                                    sortLey: sortKey,
                                    sortOrder: sortOrder,
                                    data: result.rows,
                                };
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
                throw new WError(error, 'Repository.search()');
            });
    }

    /**
     * Load methods from given directory
     * @param {string} dir                  Directory full path
     * @throw {Error}                       Throws if couldn't load a file in the directory
     */
    _loadMethods(dir) {
        for (let name of fs.readdirSync(dir)) {
            let methodName = this._util.dashedToCamel(name.replace(/\.js$/, ''));
            let file = path.join(dir, name);
            try {
                this[methodName] = require(file).bind(this);
            } catch (error) {
                throw new WError(error, `Repository._loadMethods() - processing: ${name}`);
            }
        }
    }
}

module.exports = Repository;
