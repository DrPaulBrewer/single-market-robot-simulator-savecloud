# single-market-robot-simulator-savecloud

Helper to save single-market-robot-simulator simulation logs to a google cloud storage bucket

## Initialization

    const storage = require('@google-cloud/storage', {optional api key});

**Pass storage object to initialize savecloud**

    const saveCloud = require('single-market-robot-simulator-savecloud')(storage);

## Usage

`savecloud(sim)` returns a Promise that resolves when everything is saved

`sim.config.gcloud.bucket` should contain a google cloud storage bucket name

`sim.config.gcloud.dir` should contain a "directory" where all log.csv files and the sim.json file will be stored in the bucket

The `sim.config.gcloud` properties are deleted before storing `sim.config` in sim.json


