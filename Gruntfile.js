module.exports = function (grunt) {
    "use strict";

    grunt.initConfig({
        localneo: {
            default: {
                options: {
                    basePath: '.'
                }
            }
        }
    });

    grunt.loadTasks('tasks');

    grunt.registerTask('default', ['localneo']);
};