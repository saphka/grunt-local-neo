module.exports = function (grunt) {
    "use strict";

    require("dotenv").config();

    function mapRouteToProxy(route, options) {
        switch (route.target.type) {
            case "service":
                return mapServiceToProxy(route, options);
            case "destination":
                return mapDestinationToProxy(route, options);
            case "application":
                return mapApplicationToProxy(route, options);
            default:
                return null;
        }
    }

    function mapRouteToPath(route, options) {
        switch (route.target.type) {
            case "application":
                return mapApplicationToPath(route, options);
            default:
                return null;
        }
    }

    function mapServiceToProxy(route, options) {
        switch (route.target.name) {
            case "sapui5":
                let proxy = {
                    context: route.path,
                    host: "sapui5.hana.ondemand.com",
                    https: true,
                    rewrite: {}
                };

                proxy.rewrite[route.path] = (options.sapUi5 ? "/" + options.sapUi5 : "") + route.target.entryPath;

                return proxy;
            default:
                return null;
        }
    }

    function mapDestinationToProxy(route, options) {
        let host = process.env["DEST_" + route.target.name + "_HOST"],
            user = process.env["DEST_" + route.target.name + "_USER"],
            password = process.env["DEST_" + route.target.name + "_PASSWORD"];

        if (!host) {
            grunt.log.error("No host specified for destination '" + route.target.name + "'. Skipping");
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
            proxy.headers.Authorization = "Basic " + Buffer.from(user + ":" + password).toString("base64");
        }

        return proxy;
    }

    function mapApplicationToProxy(route, options) {
        let path = process.env["DEST_" + route.target.name + "_PATH"];

        if (!path) {
            grunt.log.error("No path specified for application '" + route.target.name + "'. Skipping");
            return null;
        }

        let proxy = {
            context: route.path,
            host: "localhost",
            https: false,
            headers: {},
            rewrite: {}
        };

        proxy.rewrite[route.path] = route.target.entryPath ? route.target.entryPath : "";

        return proxy;
    }

    function mapApplicationToPath(route, options) {
        let path = process.env["DEST_" + route.target.name + "_PATH"];

        if (!path) {
            grunt.log.error("No path specified for application '" + route.target.name + "'. Skipping");
            return null;
        }

        return path;
    }

    grunt.loadNpmTasks("grunt-connect-proxy-updated");
    grunt.loadNpmTasks("grunt-contrib-connect");

    grunt.registerTask("localneo", "Local NEO runtime", function () {

        let options = this.options({
            port: 62493,
            open: false,
            basePath: "./webapp",
            index: "",
            sapUi5: "",
            secure: false,
            proxies: [],
            localResources: []
        });

        grunt.verbose.writeln("Running on port: " + options.port);
        grunt.verbose.writeln("Serving from '" + options.basePath + "'")
        if (options.open) {
            grunt.verbose.writeln("Index file '" + options.index + "' will be opened");
        }
        if (options.sapUi5) {
            grunt.verbose.writeln("SAPUI5 version: " + options.sapUi5);
        } else {
            grunt.log.writeln("SAPUI5 version not specified. Latest will be used");
        }

        let proxies = options.proxies.slice();
        let localResources = options.localResources.slice();
        let neoapp = grunt.file.readJSON("neo-app.json");

        if (Array.isArray(neoapp.routes)) {
            proxies = proxies.concat(neoapp.routes.map(route => mapRouteToProxy(route, options)).filter(route => !!route));

            localResources = localResources.concat(neoapp.routes.map(route => mapRouteToPath(route, options)).filter(route => !!route));
        }

        function rewriteSetCookie(req, res, next) {
            let oldWriteHead = res.writeHead;
            res.writeHead = function () {
                let cookie = res.getHeader("Set-Cookie");
                if (cookie) {
                    res.setHeader("Set-Cookie", cookie.map(function (item) {
                        let result = item.replace(/Domain=.*;/g, "");

                        if (!options.secure) {
                            result = result.replace(/Secure;/g, "")
                        }

                        grunt.verbose.writeln("Rewrote cookies. Was: " + item + ". Now: " + result);

                        return result;
                    }));
                }
                oldWriteHead.apply(res, arguments);
            };
            next();
        }

        grunt.config("connect", {
            server: {
                options: {
                    port: options.port,
                    hostname: "localhost",
                    protocol: options.secure ? "https" : "http",
                    keepalive: true,
                    open: options.open,
                    base: [{
                        path: options.basePath,
                        options: {
                            index: options.index
                        }
                    }].concat(localResources),
                    directory: options.basePath,
                    middleware: function (connect, options, middleware) {
                        return [
                            rewriteSetCookie,
                            require("grunt-connect-proxy-updated/lib/utils").proxyRequest
                        ].concat(middleware);
                    }
                },
                proxies: proxies
            }
        });

        grunt.task.run(["configureProxies:server", "connect:server"]);

    });


};