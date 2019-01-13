# grunt-local-neo
> Local SAP WebIDE NEO Runtime

## Getting Started
This plugin requires Grunt `^1.0.3`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-local-neo --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-local-neo');
```


## The "localneo" task

### Overview
In your project's Gruntfile, add a section named `localneo` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
    localneo: {
        options: {
            // Task-specific options go here.
        }
    }
});
```

The task will start a static web server and proxy all requests for paths specified in `neo-app.json` file.
Intended for local testing of SAPUI5 applications.

### Options

#### options.port
Type: `Number`
Default value: `62493`

Server port 

#### options.open
Type: `Boolean`
Default value: `false`

Open index file after server start

#### options.basePath
Type: `String`
Default value: `"./webapp"`

Base path to server files from

#### options.index
Type: `String`
Default value: `""`

Default index file name

#### options.sapUi5
Type: `String`
Default value: `""`

SAPUI5 version. If none specified, latest will be used

### Environment variables
Task uses environment variables for destinations configuration.
See [dotenv](https://www.npmjs.com/package/dotenv) plugin for details.

To configure a destination, create `.env` file in root folder.
Add this line:
```text
DEST_<Destination name>_HOST=<Destination host w/o protocol>
``` 
If your destination requires authentication, add the followilng lines (only basic is supported):
```text
DEST_<Destination name>_USER=<User>
DEST_<Destination name>_PASSWORD=<Password>
```

### Usage Examples

#### Default set up
```js
grunt.initConfig({
    localneo: {
        options: {
        }
    }
});
```

Will run on https://localhost:62493 and serve from `./webapp' directory

#### Specific port and auto-open
```js
grunt.initConfig({
    localneo: {
        options: {
            port: 12345,
            open: true,
            index: "test.html"
        }
    }
}); 
```

Will run on https://localhost:12345 and open https://localhost:12345/test.html after start

## Contributing
In lieu of a formal style guide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
1.0.0 - Project created 


 

