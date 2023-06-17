'use strict';

var assert = require('proclaim');
var sinon = require('sinon');
var mockery = require('mockery');

var moduleName = '../../../lib/processor';

var newSpyResponse = require('../mocks/response');

var mockConfig = {
	log: require('../mocks/log'),
	timer: sinon.stub().returns(sinon.stub()),
	env: {
		tier: sinon.stub(),
		host: sinon.stub().returns('ci'),
		isDevelopment: sinon.stub().returns(false)
	},
	argv: {}
};

describe('Request processor', function () {
	beforeEach(function () {
		mockery.enable({
			useCleanCache: true,
			warnOnUnregistered: false,
			warnOnReplace: false
		});
		mockery.registerMock('../timestamp', {
			value: 1234567890
		});
		mockery.registerMock('../package.json', {
			version: '5.8.2'
		});
		mockery.registerMock('./statsd', require('../mocks/statsd'));
		mockery.registerMock('./dispatch', require('../mocks/dispatch'));
		mockery.registerMock('./router', require('../mocks/router'));
		mockery.registerMock('http-proxy', require('../mocks/http-proxy'));
		mockery.registerMock('url', require('../mocks/url'));
	});
	afterEach(function () {
		mockery.deregisterAll();
		mockery.disable();
	});

	describe('Configuring the proxy', function () {
		it('Should not enable `autoRewrite` and `protocolRewrite` by default', function () {
			var proxy = require('http-proxy');
			require(moduleName)(mockConfig, {});
			assert.isFalse(proxy.createProxyServer.firstCall.args[0].autoRewrite);
			assert.isNull(proxy.createProxyServer.firstCall.args[0].protocolRewrite);
		});

		it('Should allow `autoRewrite` and `protocolRewrite` to be configured', function () {
			mockConfig.argv['rewrite-redirect'] = true;
			mockConfig.argv['rewrite-protocol'] = 'http';

			var proxy = require('http-proxy');
			require(moduleName)(mockConfig, {});
			assert.isTrue(proxy.createProxyServer.firstCall.args[0].autoRewrite);
			assert.strictEqual(proxy.createProxyServer.firstCall.args[0].protocolRewrite, 'http');

			mockConfig.argv = {};
		});
	});

	describe('Modifying the request', function () {
		var req;

		beforeEach(function () {
			req = require('../mocks/request');
		});

		it('Should add a header X-Shunter-Deploy-Timestamp with the deployment timestamp', function () {
			var processor = require(moduleName)(mockConfig, {});
			var next = sinon.stub();

			req.url = '/foo';
			processor.timestamp(req, {}, next);
			assert.equal(req.headers['X-Shunter-Deploy-Timestamp'], '1234567890');
			assert.equal(req.url, '/foo');
			assert.isTrue(next.calledOnce);
		});

		it('Should override the X-Shunter-Deploy-Timestamp with the current time in dev mode', function () {
			mockConfig.env.isDevelopment.returns(true);
			var processor = require(moduleName)(mockConfig, {});
			var next = sinon.stub();

			req.url = '/foo';
			processor.timestamp(req, {}, next);
			assert.notEqual(req.headers['X-Shunter-Deploy-Timestamp'], '1234567890');
			assert.equal(req.url, '/foo');
			assert.isTrue(next.calledOnce);
		});

		it('Should add a header X-Shunter with the Shunter version being used', function () {
			var processor = require(moduleName)(mockConfig, {});
			var next = sinon.stub();

			req.url = '/foo';
			processor.shunterVersion(req, {}, next);
			assert.equal(req.headers['X-Shunter'], '5.8.2');
			assert.isTrue(next.calledOnce);
		});
	});

	describe('Intercepting response', function () {
		var res;
		var renderer;
		var mockTimer;

		beforeEach(function () {
			renderer = require('../mocks/renderer')();
			res = newSpyResponse();
			mockTimer = sinon.stub().returns(sinon.stub());
		});
		afterEach(function () {
			renderer.render.resetHistory();
		});

		describe('with default configuration', function () {
			it('Should pass through responses that don\'t have the x-shunter+json mime type', function () {
				var processor = require(moduleName)({
					argv: {},
					timer: mockTimer
				}, {});
				var callback = sinon.stub();

				var req = {};

				res.getHeader.withArgs('Content-type').returns('text/html');

				processor.intercept(req, res, callback);
				res.writeHead();
				assert.isTrue(res.__originalWriteHead.calledOnce);
			});

			it('Should pass through headers from the backend', function () {
				var processor = require(moduleName)({
					argv: {},
					timer: mockTimer
				}, {});
				var callback = sinon.stub();

				var req = {};
				var headers = {
					Location: 'https://www.nature.com'
				};

				processor.intercept(req, res, callback);

				require('http-proxy').createProxyServer().on.yield({
					statusCode: 303,
					statusMessage: 'See Other',
					headers: headers
				}, null, res);

				assert.isTrue(res.__originalWriteHead.calledOnce);
				assert.equal(res.__originalWriteHead.firstCall.args[0], 303);
				assert.equal(res.__originalWriteHead.firstCall.args[1], 'See Other');
				assert.equal(res.__originalWriteHead.firstCall.args[2], headers);
			});

			it('Should not break after handling an error', function () {
				var processor = require(moduleName)({
					argv: {},
					timer: mockTimer
				}, {});
				var callback = sinon.stub();

				var req = {};
				var headers = {
					Location: 'https://www.nature.com'
				};

				processor.intercept(req, res, callback);

				require('http-proxy').createProxyServer().on.yield({
					statusCode: 404,
					statusMessage: 'Not here',
					headers: headers
				}, null, res);

				assert.isTrue(res.__originalWriteHead.calledOnce);
				assert.equal(res.__originalWriteHead.firstCall.args[0], 404);

				var req2 = {};
				var res2 = newSpyResponse();

				processor.intercept(req2, res2, callback);

				require('http-proxy').createProxyServer().on.yield({
					statusCode: 303,
					statusMessage: 'See Other',
					headers: headers
				}, null, res2);

				assert.isTrue(res2.__originalWriteHead.calledOnce);
				assert.equal(res2.__originalWriteHead.firstCall.args[0], 303);
				assert.equal(res2.__originalWriteHead.firstCall.args[1], 'See Other');
				assert.equal(res2.__originalWriteHead.firstCall.args[2], headers);
			});

			it('Should intercept responses with an x-shunter+json mime type', function () {
				var tier = sinon.stub();
				var processor = require(moduleName)({
					env: {
						tier: tier
					},
					argv: {},
					timer: mockTimer
				}, renderer);
				var callback = sinon.stub();

				var req = {url: '/test/url'};

				res.getHeader.withArgs('Content-type').returns('application/x-shunter+json');
				processor.intercept(req, res, callback);

				res.writeHead();
				res.write(Buffer.from('{"foo":"bar"}'));
				res.end();

				assert.isTrue(renderer.render.calledOnce);
				assert.equal(renderer.render.firstCall.args[2].foo, 'bar');
			});
		});
		describe('with configured trigger header', function () {
			var trigger = {
				header: 'render-with',
				matchExpression: 'shunter'
			};
			var req = {url: '/test/url'};
			var buildProcessor = function (moduleName, renderer) {
				var processor = require(moduleName)({
					argv: {},
					timer: mockTimer,
					trigger: trigger
				}, renderer);
				return processor;
			};

			it('Should intercept responses with the configured header and matching value', function () {
				var processor = buildProcessor(moduleName, renderer);

				res.getHeader.withArgs('render-with').returns('shunter');
				processor.intercept(req, res, sinon.stub());
				res.writeHead();
				res.write(Buffer.from('{"foo":"bar"}'));
				res.end();

				assert.isTrue(renderer.render.calledOnce);
				assert.equal(renderer.render.firstCall.args[2].foo, 'bar');
			});

			it('Should pass through responses with the configured header but non-matching value', function () {
				var processor = buildProcessor(moduleName, {});

				res.getHeader.withArgs('render-with').returns('wont-match');
				processor.intercept(req, res, sinon.stub());
				res.writeHead();

				assert.isTrue(res.__originalWriteHead.calledOnce);
			});

			it('Should pass through responses without the configured header', function () {
				var processor = buildProcessor(moduleName, {});

				processor.intercept(req, res, sinon.stub());
				res.writeHead();

				assert.isTrue(res.__originalWriteHead.calledOnce);
			});
		});

		it('Should JSON if the `jsonViewParameter` parameter is present', function () {
			var processor = require(moduleName)({
				env: {
					tier: sinon.stub()
				},
				argv: {},
				timer: mockTimer,
				jsonViewParameter: 'json'
			}, renderer);
			var dispatch = require('./dispatch')();
			var callback = sinon.stub();

			var req = {
				query: {
					json: true
				},
				url: '/test/url?json=true'
			};

			res.getHeader.withArgs('Content-type').returns('application/x-shunter+json');
			processor.intercept(req, res, callback);

			res.writeHead();
			res.write(Buffer.from('{"foo":"bar"}'));
			res.end();

			assert.equal(renderer.render.callCount, 0);
			assert.isTrue(dispatch.send.calledOnce);
			assert.isNull(dispatch.send.firstCall.args[0]);
			assert.equal(dispatch.send.firstCall.args[1], '{\n\t"foo": "bar"\n}');
		});

		it('Should construct responses across multiple writes', function () {
			var tier = sinon.stub();
			var processor = require(moduleName)({
				env: {
					tier: tier
				},
				argv: {},
				timer: mockTimer
			}, renderer);
			var callback = sinon.stub();

			var req = {url: '/test/url'};

			res.getHeader.withArgs('Content-type').returns('application/x-shunter+json');
			processor.intercept(req, res, callback);

			res.writeHead();
			res.write(Buffer.from('{"foo":'));
			res.write(Buffer.from('"bar"}'));
			res.end();

			assert.isTrue(renderer.render.calledOnce);
			assert.equal(renderer.render.firstCall.args[2].foo, 'bar');
		});

		it('Should safely reconstruct multibyte characters that are split between writes', function () {
			var value = 'abc⩽def';
			var raw = '{"foo":"' + value + '"}';
			var source = Buffer.from(raw);
			var length = Buffer.byteLength(raw);
			var firstChunkLength = raw.indexOf('c') + 2; // Split in the middle of the ⩽ character
			var secondChunkLength = length - firstChunkLength;
			var firstChunk = Buffer.allocUnsafe(firstChunkLength);
			var secondChunk = Buffer.allocUnsafe(secondChunkLength);
			source.copy(firstChunk, 0, 0, firstChunkLength);
			source.copy(secondChunk, 0, firstChunkLength);

			var tier = sinon.stub();
			var processor = require(moduleName)({
				env: {
					tier: tier
				},
				argv: {},
				timer: mockTimer
			}, renderer);
			var callback = sinon.stub();

			var req = {url: '/test/url'};

			res.getHeader.withArgs('Content-type').returns('application/x-shunter+json');
			processor.intercept(req, res, callback);

			res.writeHead();
			res.write(firstChunk);
			res.write(secondChunk);
			res.end();

			assert.isTrue(renderer.render.calledOnce);
			assert.notEqual(firstChunk.toString() + secondChunk.toString(), raw);
			assert.equal(renderer.render.firstCall.args[2].foo, value);
		});

		it('Should send the rendered page', function () {
			var tier = sinon.stub();
			var processor = require(moduleName)({
				env: {
					tier: tier
				},
				argv: {},
				timer: mockTimer
			}, renderer);
			var dispatch = require('./dispatch')();
			var callback = sinon.stub();

			var req = {url: '/test/url'};

			res.getHeader.withArgs('Content-type').returns('application/x-shunter+json');
			processor.intercept(req, res, callback);

			res.writeHead();
			res.write(Buffer.from('{"foo":"bar"}'));
			res.end();

			renderer.render.firstCall.yield(null, 'Content');

			assert.equal(renderer.render.callCount, 1);
			assert.isTrue(dispatch.send.calledOnce);
			assert.isNull(dispatch.send.firstCall.args[0]);
			assert.equal(dispatch.send.firstCall.args[1], 'Content');
		});

		it('Should proxy the status code of the response', function () {
			var tier = sinon.stub();
			var processor = require(moduleName)({
				env: {
					tier: tier
				},
				argv: {},
				timer: mockTimer
			}, renderer);
			var dispatch = require('./dispatch')();
			var callback = sinon.stub();

			var req = {
				url: '/test/url'
			};

			res.getHeader.withArgs('Content-type').returns('application/x-shunter+json');
			processor.intercept(req, res, callback);

			res.writeHead(401);
			res.write(Buffer.from('{"foo":"bar"}'));
			res.end();

			renderer.render.firstCall.yield(null, 'Content');

			assert.equal(renderer.render.callCount, 1);
			assert.isTrue(dispatch.send.calledOnce);
			assert.equal(dispatch.send.firstCall.args[4], 401);
		});

		it('Should handle JSON errors', function () {
			var processor = require(moduleName)(mockConfig, renderer);
			var dispatch = require('./dispatch')();
			var callback = sinon.stub();

			var req = {url: '/test/url'};

			res.getHeader.withArgs('Content-type').returns('application/x-shunter+json');
			processor.intercept(req, res, callback);

			res.writeHead();
			res.write(Buffer.from('{"foo":bar"}'));
			assert.doesNotThrow(function () {
				res.end();
			});
			assert.equal(renderer.render.callCount, 0);
			assert.isTrue(dispatch.send.calledOnce);
			assert.instanceOf(dispatch.send.firstCall.args[0], Error);
		});

		it('Should reset the response methods once we\'re done buffering the response', function () {
			var processor = require(moduleName)(mockConfig, {});
			var callback = sinon.stub();

			var req = {url: '/test/url'};

			res.getHeader.withArgs('Content-type').returns('application/x-shunter+json');
			processor.intercept(req, res, callback);

			res.writeHead();
			assert.notEqual(res.writeHead, res.__originalWriteHead);
			assert.notEqual(res.write, res.__originalWrite);
			assert.notEqual(res.end, res.__originalEnd);
			res.end();
			assert.equal(res.writeHead, res.__originalWriteHead);
			assert.equal(res.write, res.__originalWrite);
			assert.equal(res.end, res.__originalEnd);
		});
	});

	describe('Ping', function () {
		it('Should send a 200 OK response', function () {
			var req = require('../mocks/request');
			var res = require('../mocks/response')();
			var processor = require(moduleName)(mockConfig, {});

			processor.ping(req, res);
			assert.isTrue(res.writeHead.calledWith(200));
			assert.isTrue(res.end.calledWith('pong'));
		});
	});

	describe('API', function () {
		var processor;
		var renderer;
		var dispatch;

		beforeEach(function () {
			renderer = require('../mocks/renderer')();
			dispatch = require('./dispatch')();
			processor = require(moduleName)(mockConfig, renderer);
		});

		afterEach(function () {
			renderer.renderPartial.resetHistory();
		});

		it('Should allow the template to be specified in the url', function () {
			var req = {
				url: '/hello',
				body: {world: true}
			};
			var res = {};

			processor.api(req, res);
			assert.isTrue(renderer.renderPartial.calledWith('hello', req, res, req.body));
		});

		it('Should allow the template to be specified in the request body', function () {
			var req = {
				url: '/',
				body: {
					layout: {
						namespace: 'ns',
						template: 'layout'
					}
				}
			};
			var res = {};

			processor.api(req, res);
			assert.isTrue(renderer.renderPartial.calledWith('layout', req, res, req.body));
		});

		it('Should convert the path to a template name', function () {
			var req = {
				url: '/hello/world/test',
				body: {world: true}
			};
			var res = {};

			processor.api(req, res);
			assert.isTrue(renderer.renderPartial.calledWith('hello__world__test', req, res, req.body));
		});

		it('Should return a 404 error if none of the required information is available', function () {
			var req = {
				url: '/',
				body: {}
			};
			var res = {};

			processor.api(req, res);
			assert.isTrue(renderer.renderPartial.notCalled);
			assert.instanceOf(dispatch.send.firstCall.args[0], Error);
			assert.strictEqual(dispatch.send.firstCall.args[0].status, 404);
		});

		it('Should return a 404 error if some of required information is missing', function () {
			var req = {
				url: '/',
				body: {
					layout: {
						ns: 'fail'
					}
				}
			};
			var res = {};

			processor.api(req, res);
			assert.isTrue(renderer.renderPartial.notCalled);
			assert.instanceOf(dispatch.send.firstCall.args[0], Error);
			assert.strictEqual(dispatch.send.firstCall.args[0].status, 404);
		});
	});

	describe('Proxy', function () {
		var processor;
		var dispatch;

		beforeEach(function () {
			processor = require(moduleName)(mockConfig, {});
			dispatch = require('./dispatch')();
		});

		it('Should proxy requests to the matching route', function () {
			var req = {};
			var res = {};
			var stub = sinon.stub();

			require('./router')().map.returns({
				host: 'www.nature.com',
				port: 1337
			});
			require('http-proxy').createProxyServer().web = stub;

			processor.proxy(req, res);

			assert.isTrue(stub.calledWith(req, res));
			assert.strictEqual(stub.firstCall.args[2].target, 'http://www.nature.com:1337');
		});

		it('Should default to no port', function () {
			var req = {};
			var res = {};
			var stub = sinon.stub();

			require('./router')().map.returns({
				host: 'www.nature.com'
			});
			require('http-proxy').createProxyServer().web = stub;

			processor.proxy(req, res);

			assert.isTrue(stub.calledWith(req, res));
			assert.strictEqual(stub.firstCall.args[2].target, 'http://www.nature.com');
		});

		it('Should pass a port if one is specified', function () {
			var req = {};
			var res = {};
			var stub = sinon.stub();

			require('./router')().map.returns({
				host: 'www.nature.com',
				port: '80'
			});
			require('http-proxy').createProxyServer().web = stub;

			processor.proxy(req, res);

			assert.isTrue(stub.calledWith(req, res));
			assert.strictEqual(stub.firstCall.args[2].target, 'http://www.nature.com:80');
		});

		it('Should pass the `changeOrigin` flag to the proxy if supplied by the router', function () {
			var req = {};
			var res = {};
			var stub = sinon.stub();

			require('./router')().map.returns({
				host: 'www.nature.com',
				port: 80,
				changeOrigin: true
			});
			require('http-proxy').createProxyServer().web = stub;

			processor.proxy(req, res);

			assert.isTrue(stub.calledWith(req, res));
			assert.strictEqual(stub.firstCall.args[2].changeOrigin, true);
		});

		it('Should create an `X-Orig-Host` header if `changeOrigin` is set', function () {
			var req = {
				headers: {
					host: 'hostname'
				}
			};
			var res = {};
			var stub = sinon.stub();

			require('./router')().map.returns({
				host: 'www.nature.com',
				port: 80,
				changeOrigin: true
			});
			require('http-proxy').createProxyServer().web = stub;
			processor.proxy(req, res);

			assert.isTrue(stub.calledWith(req, res));
			assert.strictEqual(stub.firstCall.args[0].headers['X-Orig-Host'], 'hostname');
		});

		it('Should return a 404 error if the route isn\'t matched', function () {
			var req = {};
			var res = {};
			var stub = sinon.stub();

			require('./router')().map.returns(false);
			require('http-proxy').createProxyServer().web = stub;

			processor.proxy(req, res);

			assert.isTrue(stub.notCalled);
			assert.instanceOf(dispatch.send.firstCall.args[0], Error);
			assert.strictEqual(dispatch.send.firstCall.args[0].status, 404);
		});

		it('Should return a 500 error if the route doesn\'t have a host property', function () {
			var req = {};
			var res = {};
			var stub = sinon.stub();

			require('./router')().map.returns({
				port: 80,
				changeOrigin: true
			});
			require('http-proxy').createProxyServer().web = stub;

			processor.proxy(req, res);

			assert.isTrue(stub.notCalled);
			assert.instanceOf(dispatch.send.firstCall.args[0], Error);
			assert.strictEqual(dispatch.send.firstCall.args[0].status, 500);
		});

		it('Should return a 502 error if the proxy connection fails', function () {
			var req = {};
			var res = {};
			var stub = sinon.stub();
			var err = new Error();

			err.code = 'ECONNREFUSED';

			require('http-proxy').createProxyServer().web = stub;

			processor.proxy(req, res);
			stub.firstCall.yield(err);

			assert.isTrue(stub.calledWith(req, res));
			assert.instanceOf(dispatch.send.firstCall.args[0], Error);
			assert.strictEqual(dispatch.send.firstCall.args[0].status, 502);
		});

		it('Should return a 500 error if the proxy fails for any other reason', function () {
			var req = {};
			var res = {};
			var stub = sinon.stub();
			var err = new Error();

			require('http-proxy').createProxyServer().web = stub;

			processor.proxy(req, res);
			stub.firstCall.yield(err);

			assert.isTrue(stub.calledWith(req, res));
			assert.instanceOf(dispatch.send.firstCall.args[0], Error);
			assert.strictEqual(dispatch.send.firstCall.args[0].status, 500);
		});
	});
});
