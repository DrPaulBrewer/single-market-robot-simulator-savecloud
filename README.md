# single-market-robot-simulator-savecloud

[![Build Status](https://travis-ci.org/DrPaulBrewer/single-market-robot-simulator-savecloud.svg?branch=master)](https://travis-ci.org/DrPaulBrewer/single-market-robot-simulator-savecloud)

Helper to save single-market-robot-simulator simulation logs to a Google Cloud Storage [tm] bucket

## Initialization

    const storage = require('@google-cloud/storage', {optional api key});

**Pass storage object to initialize savecloud**

    const saveCloud = require('single-market-robot-simulator-savecloud')(storage);

## Usage

`savecloud(sim)` returns a Promise that resolves when everything is saved

Before passing `sim` to `saveCloud` you must set these properties:

* `sim.config.gcloud.bucket` should contain a google cloud storage bucket name

* `sim.config.gcloud.dir` should contain a "directory" where all log.csv files and the sim.json file will be stored in the bucket

The `sim.config.gcloud` properties are deleted before storing the JSON-stringified `sim.config` in sim.json

### saveCloud handles retries for you

`saveCloud` uses `npm:pipe-to-storage`  to retry, at least 3 times, writing to cloud storage.

## Tests

This module is tested automatically on Travis-CI.  

Tests require modification to run locally. To test locally, replace the API key and bucket name with your own key/bucket.

## Copyright

Copyright 2017 Paul Brewer, Economic and Financial Technology Consulting LLC <drpaulbrewer@eaftc.com>

## License

The MIT License

### Trademarks

Google Cloud Storage [tm] is a trademark of Google, Inc.
