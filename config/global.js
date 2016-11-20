/**
 * Default application configuration
 */
module.exports = {
    // Project name (alphanumeric)
    project: 'arpen',

    // Load base classes and services
    autoload: [
        'src/services',
        'src/middleware'
    ],

    // Middleware, in this order
    middleware: [
        'middleware.favicon',
        'middleware.requestLogger',
        'middleware.requestParser',
        'middleware.staticFiles',
        'middleware.routes',
        'middleware.errorHandler',              // should be the last
    ],
};
