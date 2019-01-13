module.exports = function (grunt) {
    "use strict";

    grunt.initConfig({
        localneo: {
            default: {
                options: {
                    basepath: '.'
                }
            }
        }
    });

    grunt.loadTasks('tasks');

    grunt.registerTask('default', ['localneo']);
};