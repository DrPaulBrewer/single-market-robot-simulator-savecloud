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

const verifyBucketMD5 = require('verify-bucket-md5')(storage);
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


function writeTest(n, chaos){
    let sim, fileList, dir, numberOfFiles;
    let lineTests = 0;
    const expectedLines = {
	profit: n+1,
	effalloc: n+1,
	ohlc: n+1
    };
    const expectedLineTests = Object.keys(expectedLines).length;
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
	    throw new Error("expected promise list to be length "+numberOfFiles+" got: "+todolist.length);
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
	    reader.on('error', function(e){ reject(e); });
	    reader.on('end', function(){
		if (expectedLines[logname]){
		    lineTests++; // count the number of tests
		    // require the files to have the indicated number of lines
		    if (goodLines !== expectedLines[logname])
			throw new Error("expected to read "+expectedLines[logname]+" lines got "+goodLines);
		}
		// test passes if we read all the lines correctly
		if (goodLines === logdata.length)
		    resolve(true);
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
	    if (!(numberOfFiles>0)) throw new Error("expected number of files > 0, got: "+numberOfFiles);
	});
	it('none of the files should exist in the bucket', function(){
	    return existenceTest(false);
	});
	it("should write finished "+n+" period simulation to Google Cloud Storage bucket without error", function(){
	    return saveCloud(sim);
	});
	it('all log files and sim.json file exist in the bucket', function(){
	    return existenceTest(true);
	});
	it('should pass the verify-bucket-md5 test comparing the buckets md5.json file and saved file metadata', function(){
	    return verifyBucketMD5(bucket,dir+"/md5.json").then(function(status){
		if (!status[0]) throw new Error("failed verify-bucket-md5 testing, result:  "+JSON.stringify(status));
		if (status[1].length !== numberOfFiles) throw new Error("expected to test "+numberOfFiles+" files but only tested "+status[1].length+" files as good");
	    });
	});
	if (chaos){
	    it('chaos! delete trade.csv from the bucket', function(){
		return storage.bucket(bucket).file(dir+'/'+'trade.csv').delete();
	    });
	    it('should fail the verify-bucket-md5 test comparing the buckets md5.json file and saved file metadata', function(){
		return verifyBucketMD5(bucket,dir+"/md5.json").then(function(status){
		    if (status[0]) throw new Error("expected failure of verify-bucket-md5 testing, got success, result:  "+JSON.stringify(status));
		    if (status[1].length === numberOfFiles) throw new Error("expected to test less than "+numberOfFiles+" good files but got "+status[1].length+" files as good");
		    if (status[2][0]!=="trade.csv") throw new Error("expected the bad file to be trade.csv but got "+status[2][0]);
		});
	    });
	    it('should fail reading all log fles in the bucket and confirming contents against simulation logs', function(done){
		// do not return a Promise here because we are using done
		Promise.all(fileList
			    .filter((f)=>(/csv$/.test(f)))
			    .map(testAgainstLog)
			   ).then(function(){ done(new Error("fail")); }, function(){ done(); });
	    });
	    it('chaos! test will shorten fileList so deletion can proceed normally', function(){
		fileList = fileList.filter((f)=>(!(/trade.csv$/.test(f))));
		assert.equal(fileList.length, numberOfFiles-1);
		numberOfFiles--;
	    });
	} else {
	    it('read all log fles in the bucket and confirm contents against simulation logs', function(){
		return Promise.all(fileList
				   .filter((f)=>(/csv$/.test(f)))
				   .map(testAgainstLog)
				  );
	    });	    
	    it('should have tested '+expectedLineTests+' files/logs '+Object.keys(expectedLines).join(' ')+' for the number of lines/rows', function(){
		assert.equal(lineTests, expectedLineTests);
	    });
	}
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
	    return existenceTest(false);
	});
    });
}

describe("single-market-robot-simulator-saveCloud:", function(){
    writeTest(1);
    writeTest(10);
    writeTest(10,true); // add chaos
    writeTest(100);
    writeTest(500);
});
       
