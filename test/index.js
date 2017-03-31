/* jshint node:true,mocha:true,esnext:true,eqeqeq:true,undef:true,lastsemic:true */

const SMRS = require('single-market-robot-simulator');
const clone = require('clone');
const assert = require('assert');
require('should');

const storage = require('@google-cloud/storage')({
    projectId: 'eaftc-open-source-testing',
    keyFilename: './test/storage.json'
});

const readline = require('readline');

const saveCloud = require("../index.js")(storage);

const bucket = 'eaftc-travis-testing';
const bucketdir = "savecloud-testing";

const simConfig = {
    "gcloud": {
	"bucket": bucket,
	"dir": bucketdir
    },
    "logToFileSystem": false,
    "buyerValues": [
	100,
	95,
	90,
	85,
	80,
	75,
	70,
	60,
	50,
	40,
	30,
	20,
	10
    ],
    "sellerCosts": [
	10,
	20,
	30,
	40,
	50,
	60,
	70,
	80,
	90,
	100
    ],
    "numberOfBuyers": 10,
    "numberOfSellers": 10,
    "buyerAgentType": [
	"TruthfulAgent"
    ],
    "sellerAgentType": [
	"TruthfulAgent"
    ],
    "buyerRate": [
	0.2
    ],
    "sellerRate": [
	0.2
    ],
    "keepPreviousOrders": false,
    "ignoreBudgetConstraint": false,
    "xMarket": {
	"buySellBookLimit": 0,
	"resetAfterEachTrade": true
    },
    "periods": 100,
    "periodDuration": 1000,
    "L": 1,
    "H": 200,
    "integer": true,
    "silent": true,
    "version": 1
};

function configWithPeriods(simConfig,n){
    const newConfig = clone(simConfig);
    newConfig.periods = n;
    newConfig.gcloud.dir = simConfig.gcloud.dir+'/'+n;
    return newConfig;
}


function writeTest(n){
    let sim, fileList, dir, numberOfFiles;
    function existenceTest(toBe){
	if (!(numberOfFiles>0))
	    throw new Error("expected numberOfFiles>0 but got: "+numberOfFiles);
	const todolist = (fileList.map((f)=>{
	    return (storage
		    .bucket(bucket)
		    .file(dir+'/'+f)
		    .exists()
		    .then(function(data){
			if (!Array.isArray(data)) throw new Error("expected array");
			if (data.length!==1) throw new Error("expected array of length 1, got: "+data.length);
			if (data[0]!==toBe) throw new Error("expected file "+dir+"/"+f+" existence === "+toBe+' but got '+data[0]);
		    })
		   );
	}));
	if (todolist.length !== numberOfFiles)
	    throw new Error("expected promsie list to be length "+numberOfFiles+" got: "+todolist.length);
	return Promise.all(todolist);
    }
    function testAgainstLog(file){
	return new Promise(function(resolve, reject){
	    const logname = file.replace(/\.csv$/,'');
	    const logdata = sim.logs[logname].data;
	    const reader = (storage
			    .bucket(bucket)
			    .file(dir+'/'+file)
			    .createReadStream()
			   );
	    let goodLines = 0;
	    reader.on('end', function(){
		// test passes if we read all the lines
		if (goodLines === logdata.length)
		    resolve();
		else
		    reject(new Error('exoected all lines to be good at end of file. Verified  '+goodLines+' lines bue expected '+logdata.length));
	    });
	    // see http://stackoverflow.com/a/32599033/103081 for how to read a stream one line at a time
	    const lineReader = readline.createInterface({
		input: reader
	    });
	    lineReader.on('line', function(line){
		const expected = logdata[goodLines].join(",");
		if (line !== expected)
		    throw new Error("expected: "+expected+" got:"+line);
		goodLines++;
	    });
	});
    }		
    describe(''+n+' period simulation: ', function(){
	before(function(){
	    sim = new SMRS.Simulation(configWithPeriods(simConfig,n));
	    sim.run({sync:true});
	    fileList = (Object.keys(sim.logs)
			.map((k)=>(k+'.csv'))
		       );
	    fileList.push('sim.json');
	    dir = sim.config.gcloud.dir;
	    numberOfFiles = fileList.length;
	});
	it("should write finished "+n+" period simulation to Google Cloud Storage bucket without error", function(){
	    return saveCloud(sim);
	});
	it('all log files and sim.json file exist in the bucket', function(){
	    existenceTest(true);
	});
	it('read all log fles in the bucket and confirm contents against simulation logs', function(){
	    return Promise.all(fileList
			       .filter((f)=>(/csv$/.test(f)))
			       .map(testAgainstLog)
			      );
	});
	it('delete all log files and sim.json from the bucket without error', function(){
	    return Promise.all(fileList.map((f)=>{
		return (storage
			.bucket(bucket)
			.file(dir+'/'+f)
			.delete()
		       );
	    }));
	});
	it('none of the files should exist in the bucket', function(){
	    existenceTest(false);
	});
    });
}

describe("single-market-robot-simulator-saveCloud:", function(){
    writeTest(1);
    writeTest(10);
    writeTest(100);
    writeTest(500);
});
       
