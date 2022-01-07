# Contributing to Shunter

This guide is here to help new developers get started on contributing to the development of Shunter itself. It will outline the structure of the library and some of the development practices we uphold.

If you're looking for information on how to _use_ Shunter, please see the [documentation](index.md).

* [Library Structure](#library-structure)
* [Use of GitHub Issues](#issue-tracking)
* [Writing Unit Tests](#testing)
* [Static Analysis](#static-analysis)
* [Versioning](#versioning-and-releases)

## Library structure

The main files that comprise Shunter live in the `lib` folder. Shunter has been broken up into several smaller modules which serve different purposes. We'll outline the basics here:

* [`benchmark.js`](https://github.com/springernature/shunter/blob/master/lib/benchmark.js) exports a middleware which is used to benchmark request times.
* [`config.js`](https://github.com/springernature/shunter/blob/master/lib/config.js) contains the default application configuration and code to merge defaults with the user config.
* [`content-type.js`](https://github.com/springernature/shunter/blob/master/lib/content-type.js) is a small utility used to infer the content-type of a URL based on its file extension.
* [`dispatch.js`](https://github.com/springernature/shunter/blob/master/lib/dispatch.js) applies output filters to the content and returns the response to the client.
* [`dust.js`](https://github.com/springernature/shunter/blob/master/lib/dust.js) handles the application's Dust instance and registers some default helpers.
* [`input-filter.js`](https://github.com/springernature/shunter/blob/master/lib/input-filter.js) handles the loading and application of input filters.
* [`output-filter.js`](https://github.com/springernature/shunter/blob/master/lib/output-filter.js) handles the loading and application of output filters.
* [`processor.js`](https://github.com/springernature/shunter/blob/master/lib/processor.js) exports the middlewares Shunter uses for interacting with the request/response cycle.
* [`query.js`](https://github.com/springernature/shunter/blob/master/lib/query.js) exports a middleware which attaches a parsed query string object to the request.
* [`renderer.js`](https://github.com/springernature/shunter/blob/master/lib/renderer.js) handles compilation and rendering of Dust templates.
* [`router.js`](https://github.com/springernature/shunter/blob/master/lib/router.js) parses the route configuration and routes requests to the correct back end application.
* [`server.js`](https://github.com/springernature/shunter/blob/master/lib/server.js) manages the lifecycle of the worker processes Shunter uses to serve requests.
* [`shunter.js`](https://github.com/springernature/shunter/blob/master/lib/shunter.js) exports everything required for a Shunter application, and is the main entry-point.
* [`statsd.js`](https://github.com/springernature/shunter/blob/master/lib/statsd.js) wraps a StatsD instance which is used to record application metrics.
* [`watcher.js`](https://github.com/springernature/shunter/blob/master/lib/watcher.js) is a utility to watch a tree of files and reload them on change.
* [`worker.js`](https://github.com/springernature/shunter/blob/master/lib/worker.js) creates a Connect app to handle requests with the Shunter middlewares added to the stack. Instances of this app are run in each process managed by `server.js`.

## Issue tracking

We use [GitHub issues](https://github.com/springernature/shunter/issues) to log bugs and feature requests. This is a great place to look if you're interested in working on Shunter.

If you're going to pick up a piece of work, check the comments to make sure nobody else has started on it. If you're going to do it, say so in the issue comments.

We use labels extensively to categorise issues, so you should be able to find something that suits your mood. We also label [issues that might be a good starting-point](https://github.com/springernature/shunter/labels/good-starter-issue) for new developers to the project.

If you're logging a new bug or feature request, please be as descriptive as possible. Include steps to reproduce and a reduced test case if applicable.

## Testing

We maintain a fairly complete set of test suites for Shunter, and these get run on every pull-request and commit to master. It's useful to also run these locally when you're working on Shunter.

To run all the tests, you can use:

```shell
make test
```

To run all the tests and linters together (exactly as we run on a [Continuous Integration (CI) system](https://en.wikipedia.org/wiki/Continuous_integration)), you can use:

```shell
make ci
```

If you're developing new features or refactoring, make sure that your code is covered by unit tests. The `tests` directory mirrors the directory structure of the main application so that it's clear where each test belongs.

## Static analysis

As well as unit testing, we also lint our JavaScript code with [JSHint](http://jshint.com/) and [JSCS](http://jscs.info/). This keeps everything consistent and readable.

To run the linters, you can use:

```shell
make lint
```

## Versioning and releases

Most of the time, one of the core developers will decide when a release is ready to go out. You shouldn't take this upon yourself without discussing with the team.

Shunter is versioned with [semver](http://semver.org/). You should read through the [semver documentation](http://semver.org) if you're versioning Shunter.

You can check the details of our release process in our [Open Source support guide](https://github.com/springernature/frontend-playbook/blob/master/practices/open-source-support.md#release-process) in the [Springer Nature frontend playbook](https://github.com/springernature/frontend-playbook).
