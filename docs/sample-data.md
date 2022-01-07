# Sample Data

Shunter includes a tool to serve sample JSON data to which Shunter can proxy. This is helpful for mocking up and testing templates without a functioning back end in place.

This JSON-serving tool can be useful for the negotiation of data contracts between the back end and front end of an application. A format for data can be decided upon at an early stage of a feature allowing independent work to be carried out before integration. This means both parties can begin work independently with a recognition of what is expected. 

The example JSON sits in a `data` directory within the root of your Shunter project and contains dummy data that replicates the response expected from a back end app to load appropriate layouts and templates. This may negate the need to run a full back end locally to work on the front end of your project.

If you are dealing with large and complicated JSON files you may want to reduce repetition in your sample data by including a template of repeated JSON and then expand upon and modify it. For example This example javascript file requires a template.JSON and then modifies it:

```js
var json = JSON.parse(JSON.stringify(require('./template')));
json.header.title = 'article';
module.exports = json;
```

To use the `shunter-serve` command line tool, run the following:

```shell
./node_modules/.bin/shunter-serve
```

You may specify the port on which `shunter-serve` should run by using the option `-p`, this should match the port specified in the Shunter routing configuration, set in the Shunter config file or at run-time with the `-o` option. For example to listen on port 9000, run the following:

```shell
./node_modules/.bin/shunter-serve -p 9000
```

You may also set a number of milliseconds of latency for the response using the `-l` option. This can be useful for performance-related testing.

Furthermore, you may use the options `-i` and `-q` to make `shunter-serve` mimic real paths. These options let you serve JSON from the index path and instruct `shunter-serve` to respect query parameters, respectively. To use them, run the following:

```shell
./node_modules/.bin/shunter-serve -i -q
```

As a result, visiting `localhost:5401` will return an `index.json` file placed in the aforementioned `data` directory and visiting `localhost:5401/search?q=test&count=10` will return `data/search/q_count.json`.
