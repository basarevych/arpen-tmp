/**
 * Index route
 * @module index/routes/index/index
 */
const express = require('express');

/**
 * Index route class
 */
class IndexRoute {
    /**
     * Create service
     */
    constructor() {
        this.router = express.Router();
        this.router.get('/', this.index.bind(this));
    }

    /**
     * Service name is 'modules.index.routes.index'
     * @type {string}
     */
    static get provides() {
        return 'modules.index.routes.index';
    }

    /**
     * Main route
     * @param {object} req          Express request
     * @param {object} res          Express response
     * @param {function} next       Express next middleware function
     */
    index(req, res, next) {
        res.render('index', { title: 'Express' });
    }
}

module.exports = IndexRoute;