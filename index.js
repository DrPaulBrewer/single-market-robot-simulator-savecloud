/* Copyright 2017 Paul Brewer, Economic and Financial Technology Consulting LLC */
/* This file is open source software.  The MIT License applies to this software. */

/* jshint esnext:true,eqeqeq:true,undef:true,lastsemic:true,strict:true,unused:true,node:true */

"use strict";

const storage = require('@google-cloud/storage')();  // without an API key, this only works in google cloud

const Readable = require('stream').Readable;

/* custom Readable Stream closely follows example at https://nodejs.org/api/stream.html#stream_an_example_counting_stream */

function joinWithCommas(row){
    return row.join(",")+"\n";
}

class LogStream extends Readable {
    constructor(simlog, opt) {
	super(opt);
	this._log = simlog;
	this._max = simlog.data.length;
	this._index = (simlog.header)? -1 : 0;
	if (Array.isArray(simlog.header))
	    this._header = joinWithCommas(simlog.header);
    }

    _read() {
	let str, i, hungry;
	do {
	    i = this._index++;
	    str = (i<0)? (this._header): ( (i>=this._max)? null: (joinWithCommas(this._log.data[i])) );
	    if (str===null)
		hungry = this.push(null);
	    else if ((typeof str==='string') && (str.length>0))
		hungry = this.push(str, 'utf8')
	    else
		throw new Error("expected string, got: "+typeof(str)+" i is "+i+" len is "+this._max);
	} while ((i<this._max) && hungry);
    }
}

class StringStream extends Readable {
    constructor(s, opt){
	super(opt);
	this._s = s;
    }
    
    _read() {
	if (this._s){
	    const hungry = this.push(this._s, 'utf8');
	    delete this._s;
	    if (hungry) this.push(null);
	} else {
	    this.push(null);
	}
    }
}

class JSONStream extends StringStream {
    constructor(_obj){
	super(JSON.stringify(_obj));
    }
}

function promiseToSaveStream(localStream, bucketName, fileName){
    return new Promise(function(resolve, reject){
	const remote = (storage
			.bucket(bucketName)
			.file(fileName)
			.createWriteStream({resumable:false})
		       );
	localStream.on('end', function(){
	    resolve();
	});
	localStream.on('error', function(e){
	    // remote.end();
	    console.log("error while writing "+bucketName+"://"+fileName);
	    console.log("error caught in promiseToSaveStream:"+e);
	    reject(e);
	});
	localStream.pipe(remote);
    });
}

module.exports = function savecloud(sim){
    const logNames = Object.keys(sim.logs);
    const bucket = sim.config.gcloud.bucket;
    const dir = (sim.config.gcloud.dir || '')+'/';
    function promiseToSaveLog(logname){
	return promiseToSaveStream(new LogStream(sim.logs[logname]),
				   bucket,
				   dir+logname+'.csv');
    }
    function promiseToSaveSimConfig(){
	if (sim.config.gcloud) delete sim.config.gcloud;
	return promiseToSaveStream(new JSONStream(sim.config),
				   bucket,
				   dir+'sim.json');
    }
    if (typeof(sim)!=='object')
	throw new Error("missing simulation parameter to savecloud");
    if (typeof(bucket)!=='string')
	throw new Error("missing bucket parameter to savecloud");
    return (Promise
	    .all(logNames.map(promiseToSaveLog))
	    .then(promiseToSaveSimConfig)
	    .catch(function(e){ console.log("in savecloud, Error: "+e.toString()) })
		);
};

