# single-market-robot-simulator-savecloud

Helper to save single-market-robot-simulator simulation logs to a google cloud storage bucket

Exports a single function, `savecloud(sim)`, returning a Promise that resolves when everything is saved

`sim.config.gcloud.bucket` should contain a google cloud storage bucket name

`sim.config.gcloud.dir` should contain a "directory" where all log.csv files and the sim.json file will be stored in the bucket

The `sim.config.gcloud` properties are deleted before storing `sim.config` in sim.json


