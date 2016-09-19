
'use strict';

module.exports = function(dust, renderer, config) {

	// override dust load mechanism to support namespaced templates
	// and to not blow up if the template is not found
	dust.onLoad = function(name, options, callback) {
		var getTemplate = function(namespace) {
			if (!namespace.length) {
				return dust.cache[name];
			}
			namespace.push(name);
			return dust.cache[namespace.join('__')] || getTemplate(namespace.slice(0, -2));
		};

		var ns = (options && options.namespace) ? options.namespace : '';
		// DEPRECATED: If the namespace starts with the name of the host application, trim it
		ns = renderer.TEMPLATE_CACHE_KEY_PREFIX + '__' + ns.replace(/^shunter-[^_]+__/, '');

		var template = getTemplate(ns.split('__'));
		if (template) {
			callback(null, template);
		} else {
			config.log.warn('Template not found ' + name);
			callback(null, '');
		}
	};

	dust.helpers.assetPath = function(chunk, context, bodies, params) {
		var path = renderer.assetPath(context.resolve(params.src));
		if (!path) {
			return chunk;
		}
		return chunk.write(path);
	};

	dust.config.whitespace = typeof config === 'object' &&
		typeof config.argv === 'object' &&
		config.argv['preserve-whitespace'];
};
