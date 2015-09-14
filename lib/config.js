
'use strict';

module.exports = function(env, config, args) {
	// jshint maxcomplexity: 9

	config = config || {};

	env = env || process.env.NODE_ENV || 'development';

	var hostname = require('os').hostname();
	var path = require('path');
	var yargs = require('yargs');
	var extend = require('extend');
	var fs = require('fs');
	var winston = require('winston');
	var shunterRoot = path.dirname(__dirname);

	args = args || yargs
		.options('p', {
			alias: 'port',
			default: 5400,
			type: 'number'
		})
		.options('m', {
			alias: 'max-post-size',
			default: 204800,
			type: 'number'
		})
		.options('c', {
			alias: 'max-child-processes',
			default: 10,
			type: 'number'
		})
		.options('r', {
			alias: 'route-config',
			default: 'default'
		})
		.options('s', {
			alias: 'syslog',
			type: 'boolean'
		})
		.options('d', {
			alias: 'sourcedirectory',
			default: process.cwd(),
			type: 'string'
		})
		.options('o', {
			alias: 'routeoveride',
			type: 'string'
		})
		.describe({
			p: 'Port number',
			m: 'Maximum size for request body in bytes',
			c: 'Shunter will create one worker process per cpu available up to this maximum',
			s: 'Enable logging to syslog',
			o: 'specify host and port to overide or replace route config file',
			d: 'Specify the directory for the main app if you are not running it from its own directory'
		})
		.alias('h', 'help')
		.help('help')
		.alias('v', 'version')
		.version(function() {
			return require('../package').version;
		})
		.check(function(argv, args) {
			Object.keys(args).forEach(function(key) {
				if (Array.isArray(argv[key])) {
					throw new Error('Invalid argument error: `' + key + '` must only be specified once');
				}
			});
			return true;
		})
		.argv;

	var appRoot = args.sourcedirectory || process.cwd();

	var defaultConfig = {
		argv: args,
		modules: [],
		path: {
			root: appRoot,
			shunterRoot: shunterRoot,
			themes: path.join(shunterRoot, 'themes'),
			templates: path.join(appRoot, 'view'),
			public: path.join(appRoot, 'public'),
			publicResources: path.join(appRoot, 'public', 'resources'),
			resources: path.join(appRoot, 'resources'),
			shunterResources: path.join(shunterRoot, 'resources'),
			tests: path.join(appRoot, 'tests'),
			clientTests: path.join(appRoot, 'tests', 'client'),
			dust: path.join(appRoot, 'dust')
		},
		web: {
			public: '/public',
			publicResources: '/public/resources',
			resources: '/resources',
			tests: '/tests'
		},
		structure: {
			templates: 'view',
			templateExt: '.dust',
			resources: 'resources',
			styles: 'css',
			images: 'img',
			scripts: 'js',
			fonts: 'fonts',
			tests: 'tests',
			filters: 'filters',
			filtersInput: 'input',
			filtersOutput: 'output',
			dust: 'dust',
			ejs: 'ejs'
		},
		log: new winston.Logger({
			transports: [
				new (winston.transports.Console)({
					colorize: true,
					timestamp: true
				})
			]
		}),
		statsd: {
			host: 'localhost',
			prefix: 'shunter.',
			// TODO remove if/when Node 0.12 supports UDP sockets in cluster workers.
			// see https://github.com/joyent/node/issues/9261
			mock: (env === 'development' || process.versions.node.indexOf('0.12.') === 0)
		},
		timer: function() {
			var start = Date.now();
			return function(msg) {
				var diff = Date.now() - start;
				config.log.info(msg + ' - ' + diff + 'ms');
				return diff;
			};
		},

		env: {
			name: env,
			host: function() {
				return hostname;
			},
			isDevelopment: function() {
				return this.name === 'development';
			},
			isProduction: function() {
				return this.name === 'production';
			}
		}
	};
	config = extend(true, {}, defaultConfig, config);
	var localConfig = path.join(appRoot, 'config', 'local.json');
	if (fs.existsSync(localConfig)) {
		extend(true, config, require(localConfig));
	}
	if (config.argv.syslog && config.syslogAppName) {
		// jscs:disable requireCamelCaseOrUpperCaseIdentifiers
		require('winston-syslog');
		config.log.add(winston.transports.Syslog, {
			localhost: hostname,
			app_name: config.syslogAppName
		});
	}
	return config;
};
