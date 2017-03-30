/* jshint node:true,mocha:true,esnext:true,eqeqeq:true,undef:true,lastsemic:true */

const SMRS = require('single-market-robot-simulator');
const clone = require('clone');
const assert = require('assert');
require('should');

const storage = require('@google-cloud/storage')({
    projectId: 'eaftc-open-source-testing',
    keyFilename: './test/storage.json'
});

const saveCloud = require("../index.js")(storage);

const bucket = 'eaftc-travis-testing';
const dir = "savecloud-testing";

const simConfig = {
    "gcloud": {
	"bucket": bucket,
	"dir": dir
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
    return newConfig;
}


function writeTest(n){
    let sim;
    before(function(){
	sim = new SMRS.Simulation(configWithPeriods(simConfig,n));
	sim.run({sync:true});
    });
    it("should write finished "+n+" period simulation to Google Cloud Storage bucket without error", function(){
	return saveCloud(sim);
    });
}

describe("single-market-robot-simulator-saveCloud:", function(){
    writeTest(1);
    writeTest(10);
    writeTest(100);
    writeTest(500);
});
       
