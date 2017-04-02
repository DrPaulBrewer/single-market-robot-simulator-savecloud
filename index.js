/* Copyright 2017 Paul Brewer, Economic and Financial Technology Consulting LLC */
/* This file is open source software.  The MIT License applies to this software. */

/* jshint esnext:true,eqeqeq:true,undef:true,lastsemic:true,strict:true,unused:true,node:true */

"use strict";

const Readable = require('readable-stream').Readable;
const pipeToStorageFactory = require('pipe-to-storage');

/* custom Readable Stream closely follows example at https://nodejs.org/api/stream.html#stream_an_example_counting_stream */

class LogStream extends Readable {
    constructor(simlog, opt) {
	super(opt);
	this._log = simlog;
	this._max = simlog.data.length;
	this._index = 0;
    }

    _read() {
	let str, i, hungry;
	const logRow = this._log.data;
	do {
	    i = this._index++;
	    str = (i>=this._max)? null: (logRow[i].join(",")+"\n");
	    if (str===null)
		hungry = this.push(null);
	    else if ((typeof str==='string') && (str.length>0))
		hungry = this.push(str, 'utf8');
	    else
		throw new Error("LogStream._read() expected string, got: "+typeof(str)+" i is "+i+" len is "+this._max);
	} while ((i<this._max) && hungry);
    }
}

module.exports = function savecloud(storage){
    const pipeToStorage = pipeToStorageFactory(storage);
    return function(sim){
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
	    return pipeToStorage(()=>(new LogStream(sim.logs[logname])),
				 bucket,
				 dir+logname+'.csv').then(addMD5);
	}
	function promiseToSaveSimConfig(){
	    if (sim.config.gcloud) delete sim.config.gcloud;
	    return pipeToStorage(JSON.stringify(sim.config,null,2),
				 bucket,
				 dir+'sim.json').then(addMD5);
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
		.then(promiseToSaveMD5)
	       );
    };
};

