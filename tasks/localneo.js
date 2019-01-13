module.exports = function (grunt) {
    "use strict";

    require("dotenv").config();

    function rewriteSetCookie(req, res, next) {
        let oldWriteHead = res.writeHead;
        res.writeHead = function () {
            let cookie = res.getHeader("Set-Cookie");
            if (cookie) {
                res.setHeader("Set-Cookie", cookie.map(function (item) {
                    return item.replace(/Domain=.*;/g, "");
                }));
            }
            oldWriteHead.apply(res, arguments);
        };
        next();
    }

    function mapRouteToProxy(route, options) {
        switch (route.target.type) {
            case "service":
                return mapServiceToProxy(route, options);
            case "destination":
                return mapDestinationToProxy(route, options);
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

                proxy.rewrite[route.path] = (options.sapui5 ? "/" + options.sapui5 : "") + route.target.entryPath;

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

    grunt.loadNpmTasks("grunt-connect-proxy-updated");
    grunt.loadNpmTasks("grunt-contrib-connect");

    grunt.registerMultiTask("localneo", "Local NEO runtime", function () {

        let options = this.options({
            port: 62493,
            open: false,
            basePath: "./webapp",
            index: "",
            sapUi5: "",
        });

        let proxies = [];
        let neoapp = grunt.file.readJSON("neo-app.json");

        if (Array.isArray(neoapp.routes)) {
            proxies = neoapp.routes.map(route => mapRouteToProxy(route, options)).filter(route => !!route);
        }

        grunt.config("connect", {
            server: {
                options: {
                    port: options.port,
                    hostname: "localhost",
                    protocol: "https",
                    keepalive: true,
                    open: options.open,
                    base: [{
                        path: options.basepath,
                        options: {
                            index: options.index
                        }
                    }],
                    middleware: function (connect, options, middleware) {
                        return [
                            rewriteSetCookie, require("grunt-connect-proxy-updated/lib/utils").proxyRequest].concat(middleware);
                    }
                },
                proxies: proxies
            }
        });

        grunt.task.run(["configureProxies:server", "connect:server" ]);

    });


};