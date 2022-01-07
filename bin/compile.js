#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var glob = require('glob');
var mkdirp = require('mkdirp');
var uglify = require('uglify-js');
var yargs = require('yargs');

var argv = yargs
	.options('x', {
		alias: 'extra-js',
		type: 'string'
	})
	.options('r', {
		alias: 'resource-module',
		type: 'string'
	})
	.alias('h', 'help')
	.help()
	.describe({
		x: 'Extra JS paths to minify',
		r: 'Name of modules with resources to include in the build, can specify several of these flags'
	})
	.argv;

var config = require('../lib/config')('production', null, {});

// All files named main.js will be minified, extra files to minify can be specified here
var EXTRA_MINIFY_PATHS = [];
if (argv['extra-js']) {
	EXTRA_MINIFY_PATHS = Array.isArray(argv['extra-js']) ? argv['extra-js'] : [argv['extra-js']];
}

var resourceModules;
if (argv['resource-module']) {
	resourceModules = (
		Array.isArray(argv['resource-module']) ?
			argv['resource-module'] :
			[argv['resource-module']]
	);
	config.modules = resourceModules;
}

var renderer = require('../lib/renderer')(config);

var environment = renderer.environment;
var manifest = renderer.manifest;

environment.cssCompressor = 'csswring';

// Crude listener for errors, replace with domain once that is stable
process.on('uncaughtException', function (err) {
	console.error('Caught exception: ' + err);
	process.exit(128);
});

var compile = function (data, callback) {
	var findAssets = function () {
		var pattern = new RegExp('\.(' + [].slice.call(arguments, 0).join('|') + ')$');
		return Object.keys(data.assets).filter(function (key) {
			return key.match(pattern);
		});
	};

	var deleteAsset = function (name) {
		delete manifest.assets[name];
		return null;
	};

	var stylesheets = findAssets('css').map(function (name) {
		var asset = environment.findAsset(name);
		var content = asset ? asset.toString() : null;

		if (!content) {
			return deleteAsset(name);
		}

		return {
			path: config.path.publicResources + '/' + data.assets[name],
			content: content
		};
	}).filter(function (stylesheet) {
		return stylesheet !== null;
	});

	var jsToMinify = ['main'].concat(EXTRA_MINIFY_PATHS);

	var javascripts = findAssets('js').filter(function (name) {
		for (var i = 0; jsToMinify[i]; ++i) {
			if (name.indexOf(jsToMinify[i]) !== -1) {
				return true;
			}
		}
		return false;
	}).map(function (name) {
		var asset = environment.findAsset(name);
		var content = asset ? asset.toString() : null;
		var start;
		var end;

		if (!content) {
			return deleteAsset(name);
		}
		start = new Date();
		content = uglify.minify(content, {
			fromString: true
		}).code;
		end = new Date();
		// Note: suspect this part of the process is timing out on build, extra logging to test
		console.log('Uglifying ' + name + ' took ' + (end - start) + 'ms');

		return {
			path: config.path.publicResources + '/' + data.assets[name],
			content: content
		};
	}).filter(function (script) {
		return script !== null;
	});
	// Save the updated stylesheets and javascripts, then save the manifest
	async.map(stylesheets.concat(javascripts), function (resource, fn) {
		console.log('Writing resource to ' + resource.path);
		fs.writeFile(resource.path, resource.content, 'utf8', fn);
	}, function () {
		manifest.save(callback);
	});
};

var generate = function (callback) {
	async.waterfall([
		function (fn) {
			mkdirp(config.path.publicResources, fn);
		},
		function (dir, fn) {
			// Glob returns absolute path and we need to strip that out
			var readGlobDir = function (p, cb) {
				var pth = p.replace(/\\\?/g, '\/'); // Glob must use / as path separator even on windows
				glob(pth + '/**/*.*', function (er, files) {
					if (er) {
						return cb(er);
					}
					return cb(null, files.map(function (f) {
						return path.relative(p, f);
					}));
				});
			};
			// Returns a flat array of files with relative paths
			async.concat(environment.paths, readGlobDir, fn);
		},
		function (files) {
			var data = null;
			try {
				data = manifest.compile(files.filter(function (file) {
					return /(?:\.([^.]+))?$/.exec(file) === 'scss';
				}));
			} catch (err) {
				callback(err, null);
			}
			if (data) {
				compile(data, callback);
			}
		},
		function (files) {
			var data = null;
			try {
				data = manifest.compile(files.map(function (file) {
					return file.replace(/\.ejs$/, '');
				}));
			} catch (err) {
				callback(err, null);
			}
			if (data) {
				compile(data, callback);
			}
		}
	]);
};

generate(function (err) {
	if (err) {
		console.error('Failed to generate manifest: ' + (err.message || err.toString()));
		process.exit(128);
	} else {
		console.log('Manifest compiled');
		process.exit(0);
	}
});
