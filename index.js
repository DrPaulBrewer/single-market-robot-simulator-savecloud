/* Copyright 2017 Paul Brewer, Economic and Financial Technology Consulting LLC */
/* This file is open source software.  The MIT License applies to this software. */

/* jshint esnext:true,eqeqeq:true,undef:true,lastsemic:true,strict:true,unused:true,node:true */

"use strict";

const Readable = require('readable-stream').Readable;
const pipeToStorageFactory = require('pipe-to-storage');


/* custom Readable Stream closely follows example at https://nodejs.org/api/stream.html#stream_an_example_counting_stream */

module.exports = function savecloud(storage){
    const pipeToStorage = pipeToStorageFactory(storage);
    return function(sim, startTime){
	const logNames = Object.keys(sim.logs);
	const bucket = sim.config.gcloud.bucket;
	let dir = sim.config.gcloud.dir;
	if ( (dir !== '') && (dir[dir.length-1]!=='/') ) dir = dir+'/';
	const md5s = {};
	function addMD5(info){
	    const fname = info.file.replace(dir,'');
	    md5s[fname] = info.md5;
	}
	function promiseToSaveLog(logname){
	    return pipeToStorage(()=>(sim.logs[logname].createReadStream(Readable)),
				 bucket,
				 dir+logname+'.csv').then(addMD5);
	}
	function promiseToSaveSimConfig(){
	    if (sim.config.gcloud) delete sim.config.gcloud;
	    return pipeToStorage(JSON.stringify(sim.config,null,2),
				 bucket,
				 dir+'sim.json').then(addMD5);
	}
	function promiseToSaveUsage(){
	    if (startTime){
		const endTime = Date.now();
		const elapsedTime =  endTime-startTime;
		const periods = sim.config.periods;
		const periodsRequested = sim.config.periodsRequested || sim.config.periods;
		const s = JSON.stringify({ startTime, endTime, elapsedTime, periods, periodsRequested, dir },null,2);
		return pipeToStorage(s,
				     bucket,
				     dir+'usage.json').then(addMD5);
	    }
	    return Promise.resolve();
	}
	function promiseToSaveMD5(){
	    return pipeToStorage(JSON.stringify(md5s,null,2),
				 bucket,
				 dir+'md5.json');
	}
	if (typeof(sim)!=='object')
	    throw new Error("missing simulation parameter to savecloud");
	if (typeof(bucket)!=='string')
	    throw new Error("missing bucket parameter to savecloud");
	return (Promise
		.all(logNames.map(promiseToSaveLog))
		.then(promiseToSaveSimConfig)
		.then(promiseToSaveUsage)
		.then(promiseToSaveMD5)
	       );
    };
};

