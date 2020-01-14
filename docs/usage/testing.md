# Testing

When writing unit tests for Shunter-based apps, there will be certain fixtures that require help from Shunter, such as rendering a HTML partial from a Dust template with dummy JSON input, or writing compiled JavaScript into a test runner.

[Testing Templates](#testing-templates) explains how to use Shunter's exported function `testhelper()` that helps you set up and tear down HTML partials.

[Testing Client-Side JavaScript](testing-client-side-javascript) explains how to use the `shunter-test-client` script to run client-side unit tests from the command line.

## Testing Templates

As dust templates can contain logic, there will be scenarios where you want to test that your code behaves as expected.

In your test spec, you need to load in the test helper from shunter, as you will need some of shunter's features to render the templates for testing.

Other dependencies are up to you. Shunter uses [Mocha](https://mochajs.org/) for testing, but you can use any other test runner.

An example client test could be as follows:

```js
var assert = require('assert');
var rootdir = __dirname.substring(0, __dirname.indexOf('/tests/'));
var helper = require('shunter').testhelper();

describe('Foo bar', function() {
    before(function() {
        helper.setup(rootdir + '/view/template.dust', rootdir + '/view/subdir/template.dust');
    });
    after(helper.teardown);

    it('Should do something', function(done) {
        helper.render('template', {
            foo: 'bar',
            lorem: 'ipsum'
        }, function(error, $, output) {
            assert.strictEqual($('[data-test="fooitem"]').length, 1);
            done();
        });
    });
});
```

In the `helper.render` callback, the `$` parameter is a [Cheerio](https://github.com/cheeriojs/cheerio) instance which allows you to use jQuery-like functions to access the render output. The `output` parameter contains the full output as a string.

You can use the following syntax to pass extra arguments to the `render` function:

```js
helper.render(template, req, res, data, callback);
```

This could be useful in cases where you want to test request objects, like checking for custom headers or cookies.

When testing templates that are in subfolders, be sure to pass in any subfolders in the same way that you would include a partial:

```js
helper.render('mysubfolder___templatename', {
    foo: 'bar'
}, function(error, $, output) {
    // etc etc
});
```

You can test individual templates by running mocha directly with the command:

```sh
./node_modules/mocha/bin/mocha -R spec -u bdd test/myfolders/mytemplate-spec.js
```

In addition to these tests we recommend using [Dustmite](https://github.com/nature/dustmite) to lint your dust files and ensure that they are all syntactically valid.

## Testing Client-Side JavaScript

Shunter provides a command-line script that will:

* build a test runner page for Mocha-PhantomJS that loads the JavaScript you need to test with Mincer, adds any test specification files found in the folder set in `config.path.clientTests` (by default, 'tests/client'), then sets up the mocha libraries for client-side testing. Dust templates stored in `config.path.templates` (by default: `/view`) will be compiled and exposed to the test runner page. They can be targeted using a combination of their location and name. A template `/view/foo/bar.dust` would be exposed to the test page as `foo__bar` and can be rendered by calling `dust.render('foo__bar', {}, function (err, rendered) {…})` as described in the [relevant chapter of the dust documentation](http://www.dustjs.com/guides/rendering/).
* run your tests with console output detailing whether they passed or failed.
* exit to the command line with an exit code of 0 for success and a positive integer for failure so that you can run on CI

This means your code under test is compiled and loaded in the same way it would be when running the app in development mode.

The script makes use of [mocha-phantomjs-core](https://github.com/nathanboktae/mocha-phantomjs-core), and the test runner page loads in [Proclaim](https://github.com/rowanmanning/proclaim) as an assertion library.

Before you can use the test runner, you'll need to [install PhantomJS](http://phantomjs.org/) separately.

You can run your client-side tests with the command:

```sh
./node_modules/.bin/shunter-test-client
```

### Optional arguments

#### Test just one spec file

```sh
./node_modules/.bin/shunter-test-client --spec file-spec
```

#### Test in browsers with Sauce Labs

Requires Sauce Connect, see https://docs.saucelabs.com/reference/sauce-connect/
Once Sauce Connect is installed, you need to run it with:

```sh
bin/sc -u YOUR_USERNAME -k YOUR_ACCESS_KEY
```

Then you can run the command:

```sh
./node_modules/.bin/shunter-test-client --browsers
```

#### Add a resource module

Add a resource module to the JavaScript under test (modules in your config automatically added)

```sh
./node_modules/.bin/shunter-test-client --resource-module foo
```

---

Related:

- [Full API Documentation](index.md)
