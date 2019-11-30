module.exports = function (grunt) {
    "use strict";

    grunt.initConfig({
        localneo: {
            options: {
                basePath: './webapp',
                baseDir: './test'
            }
        }
    });

    grunt.loadTasks('tasks');

    grunt.registerTask('default', ['localneo']);
};