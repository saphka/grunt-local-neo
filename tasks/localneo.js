module.exports = function (grunt) {
    'use strict';

    require('dotenv').config();

    const path = require('path');
    const serverIndex = require('serve-index');
    const parseUrl = require('parseurl');
    const fs = require('fs');

    function mapRouteToProxy(route, options) {
        switch (route.target.type) {
            case 'service':
                return mapServiceToProxy(route, options);
            case 'destination':
                return mapDestinationToProxy(route, options);
            case 'application':
                return mapApplicationToProxy(route, options);
            default:
                return null;
        }
    }

    function mapRouteToPath(route, options) {
        switch (route.target.type) {
            case 'application':
                return mapApplicationToPath(route, options);
            default:
                return null;
        }
    }

    function mapServiceToProxy(route, options) {
        switch (route.target.name) {
            case 'sapui5':
                let proxy = {
                    context: route.path,
                    host: 'sapui5.hana.ondemand.com',
                    https: true,
                    rewrite: {}
                };

                proxy.rewrite[route.path] = (options.sapUi5 ? '/' + options.sapUi5 : "") + route.target.entryPath;

                return proxy;
            default:
                return null;
        }
    }

    function mapDestinationToProxy(route, options) {
        let host = process.env['DEST_' + route.target.name + '_HOST'],
            user = process.env['DEST_' + route.target.name + '_USER'],
            password = process.env['DEST_' + route.target.name + '_PASSWORD'];

        if (!host) {
            grunt.log.error('No host specified for destination "' + route.target.name + '". Skipping');
            return null;
        }

        let proxy = {
            context: route.path,
            host: host,
            https: true,
            headers: {},
            rewrite: {}
        };

        proxy.rewrite[route.path] = route.target.entryPath ? route.target.entryPath : "";

        if (user && password) {
            proxy.headers.Authorization = 'Basic ' + Buffer.from(user + ':' + password).toString('base64');
        }

        return proxy;
    }

    function mapApplicationToProxy(route, options) {
        let path = process.env['DEST_' + route.target.name + '_PATH'];

        if (!path) {
            grunt.log.error('No path specified for application "' + route.target.name + '". Skipping');
            return null;
        }

        let proxy = {
            context: route.path,
            host: 'localhost',
            port: options.port,
            https: true,
            headers: {},
            rewrite: {}
        };

        proxy.rewrite[route.path] = route.target.entryPath ? route.target.entryPath : "";

        return proxy;
    }

    function mapApplicationToPath(route, options) {
        let path = process.env['DEST_' + route.target.name + '_PATH'];

        if (!path) {
            grunt.log.error('No path specified for application "' + route.target.name + '". Skipping');
            return null;
        }

        return path;
    }

    function replaceCookie(value) {
        let result = value.replace(/Domain=.*;/g, '')
            .replace(/Secure;/g, '');
        grunt.verbose.writeln('Rewrote cookie. Was: ' + value + ". Now: " + result);
        return result;
    }

    function rewriteSetCookie(req, res, next) {
        let oldSetHeader = res.setHeader;
        res.setHeader = function (key, value) {
            if (key.toLowerCase() === "set-cookie") {
                if (Array.isArray(value)) {
                    value = value.map(replaceCookie);
                } else {
                    value = replaceCookie(value);
                }
            }
            oldSetHeader.call(this, key, value);
        };
        next();
    }

    function serveSandbox(componentId) {
        return function (req, res, next) {
            let url = parseUrl(req);

            if (url.pathname === '/sandbox.html') {
                let fileName = path.join(__dirname, '../public', 'sandbox.html');

                let render = createHtmlRender(fileName);

                let locals = {
                    component: componentId
                };

                render(locals, function (err, body) {
                    if (err) return next(err);

                    res.setHeader('X-Content-Type-Options', 'nosniff')

                    // standard headers
                    res.setHeader('Content-Type', 'text/html; charset=utf-8')
                    res.setHeader('Content-Length', Buffer.byteLength(body, 'utf8'))

                    // body
                    res.end(body, 'utf8')
                });
            } else {
                next();
            }

        }
    }

    function createHtmlRender(template) {
        return function render(locals, callback) {
            // read template
            fs.readFile(template, 'utf8', function (err, str) {
                if (err) return callback(err);

                let body = str
                    .replace(/\{\{sap-ui5-component\}\}/g, locals.component);

                callback(null, body);
            });
        };
    }

    const proxyRequest = require('grunt-connect-proxy-updated/lib/utils').proxyRequest;

    grunt.loadNpmTasks('grunt-connect-proxy-updated');
    grunt.loadNpmTasks('grunt-contrib-connect');

    grunt.registerTask('localneo', 'Local NEO runtime', function () {

        let options = this.options({
            port: 62493,
            open: false,
            baseDir: '.',
            basePath: './webapp',
            index: "",
            sapUi5: "",
            secure: false,
            component: '',
            proxies: [],
            localResources: []
        });

        let serverContentsRoot = path.join(options.baseDir, options.basePath);

        grunt.verbose.writeln('Running on port: ' + options.port);
        grunt.verbose.writeln('Serving from "' + serverContentsRoot + '"');
        if (options.open) {
            grunt.verbose.writeln('Index file "' + options.index + '" will be opened');
        }
        if (options.sapUi5) {
            grunt.verbose.writeln('SAPUI5 version: ' + options.sapUi5);
        } else {
            grunt.log.writeln('SAPUI5 version not specified. Latest will be used');
        }

        let proxies = options.proxies.slice();
        let localResources = options.localResources.slice();
        let neoApp;
        let neoAppPath = path.join(options.baseDir, '/', 'neo-app.json');
        if (grunt.file.exists(neoAppPath)) {
            neoApp = grunt.file.readJSON(neoAppPath);
            grunt.verbose.writeln('neo-app.json contents\n' + JSON.stringify(neoApp, null, 2))
        } else {
            grunt.log.writeln('neo-app.json not found at' + neoAppPath);
            neoApp = {
                routes: []
            }
        }

        if (Array.isArray(neoApp.routes)) {
            proxies = proxies.concat(neoApp.routes.map(route => mapRouteToProxy(route, options)).filter(route => !!route));

            localResources = localResources.concat(neoApp.routes.map(route => mapRouteToPath(route, options)).filter(route => !!route));
        }

        let sapui5ComponentId = options.component;

        grunt.config('connect', {
            server: {
                options: {
                    port: options.port,
                    hostname: 'localhost',
                    protocol: options.secure ? 'https' : 'http',
                    keepalive: true,
                    open: options.open,
                    base: [{
                        path: serverContentsRoot,
                        options: {
                            index: options.index
                        }
                    }].concat(localResources),
                    directory: serverContentsRoot,
                    middleware: function (connect, options, middleware) {
                        return [
                            rewriteSetCookie,
                            proxyRequest
                        ].concat(middleware.slice(0, -1))
                            .concat([
                                serverIndex(serverContentsRoot, {
                                    template: path.join(__dirname, '../public', 'directory.html')
                                }),
                                serveSandbox(sapui5ComponentId)
                            ])

                    }
                },
                proxies: proxies
            }
        });

        grunt.task.run(['configureProxies:server', 'connect:server']);

    });


};