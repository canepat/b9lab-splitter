"use strict";

// Import the third-party libraries
const Promise = require("bluebird");

// Import the local libraries and customize the web3 environment
const addEvmFunctions = require("../utils/evmFunctions.js");

addEvmFunctions(web3);

if (typeof web3.eth.getBlockPromise !== "function") {
    Promise.promisifyAll(web3.eth, { suffix: "Promise" });
}
if (typeof web3.evm.increaseTimePromise !== "function") {
    Promise.promisifyAll(web3.evm, { suffix: "Promise" });
}
if (typeof web3.version.getNodePromise !== "function") {
    Promise.promisifyAll(web3.version, { suffix: "Promise" });
}

web3.eth.expectedExceptionPromise = require("../utils/expectedExceptionPromise.js");
web3.eth.expectedOkPromise = require("../utils/expectedOkPromise.js");
web3.eth.getPastTimestamp = require("../utils/getPastTimestamp.js");
web3.eth.getTransactionReceiptMined = require("../utils/getTransactionReceiptMined.js");
web3.eth.makeSureHasAtLeast = require("../utils/makeSureHasAtLeast.js");
web3.eth.makeSureAreUnlocked = require("../utils/makeSureAreUnlocked.js");

// Import the smart contracts
const Splitter = artifacts.require("./Splitter.sol");

contract('Splitter', function(accounts) {
    const MAX_GAS = 2000000;
    const TESTRPC_SLOW_DURATION = 1000;
    const GETH_SLOW_DURATION = 15000;

    let isTestRPC, isGeth, slowDuration;
    before("should identify node", function() {
        return web3.version.getNodePromise()
            .then(function(node) {
                isTestRPC = node.indexOf("EthereumJS TestRPC") >= 0;
                isGeth = node.indexOf("Geth") >= 0;
                slowDuration = isTestRPC ? TESTRPC_SLOW_DURATION : GETH_SLOW_DURATION;
            });
    });

    let coinbase, owner, payer, firstBeneficiary, secondBeneficiary;
    before("should check accounts", function() {
        assert.isAtLeast(accounts.length, 5, "not enough accounts");

        return web3.eth.getCoinbasePromise()
            .then(function (_coinbase) {
                coinbase = _coinbase;
                // Coinbase gets the rewards, making calculations difficult.
                const coinbaseIndex = accounts.indexOf(coinbase);
                if (coinbaseIndex > -1) {
                    accounts.splice(coinbaseIndex, 1);
                }
                [owner, payer, firstBeneficiary, secondBeneficiary] = accounts;
                return web3.eth.makeSureAreUnlocked(accounts);
            })
            .then(function() {
                const initial_balance = web3.toWei(1, 'ether');
                return web3.eth.makeSureHasAtLeast(coinbase, [owner, payer, firstBeneficiary, secondBeneficiary], initial_balance)
                    .then(txObj => web3.eth.getTransactionReceiptMined(txObj));
            });
    });

    let instance;
    beforeEach("should deploy a Splitter instance", function() {
        return Splitter.new(payer, firstBeneficiary, secondBeneficiary, { from: owner, gas: MAX_GAS })
            .then(function(_instance) {
                instance = _instance;
            });
    });

    describe("#Splitter()", function() {
        it("should fail if payer address is zero", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return Splitter.new(0, firstBeneficiary, secondBeneficiary, { from : owner, gas: MAX_GAS });
                },
                MAX_GAS
            );
        });
        it("should fail if firstBeneficiary address is zero", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return Splitter.new(payer, 0, secondBeneficiary, { from : owner, gas: MAX_GAS });
                },
                MAX_GAS
            );
        });
        it("should fail if secondBeneficiary address is zero", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return Splitter.new(payer, firstBeneficiary, 0, { from : owner, gas: MAX_GAS });
                },
                MAX_GAS
            );
        });
        it("should be owned by expected owner", function() {
            this.slow(slowDuration);

            return instance.owner()
                .then(realOwner => assert.strictEqual(owner, realOwner, "not owned by expected owner"));
        });
        it("should return provided payer", function() {
            this.slow(slowDuration);

            return instance.payer()
                .then(realPayer => assert.strictEqual(payer, realPayer, "provided payer not returned"));
        });
        it("should return provided firstBeneficiary", function() {
            this.slow(slowDuration);

            return instance.firstBeneficiary()
                .then(realFirstBeneficiary => assert.strictEqual(firstBeneficiary, realFirstBeneficiary,
                    "provided firstBeneficiary not returned"));
        });
        it("should return provided secondBeneficiary", function() {
            this.slow(slowDuration);

            return instance.secondBeneficiary()
                .then(realSecondBeneficiary => assert.strictEqual(secondBeneficiary, realSecondBeneficiary,
                    "provided secondBeneficiary not returned"));
        });
        it("should have emitted LogCreation event", function() {
            this.slow(slowDuration);

            return web3.eth.getTransactionReceiptMined(instance.transactionHash)
                .then(function(receipt) {
                    const EXPECTED_TOPIC_LENGTH = 4;
                    assert.equal(receipt.logs.length, 1); // just 1 LogCreation event

                    const logEvent = receipt.logs[0];
                    assert.equal(logEvent.topics[0], web3.sha3("LogCreation(address,address,address)"));
                    assert.equal(logEvent.topics.length, EXPECTED_TOPIC_LENGTH);

                    const formattedEvent = instance.LogCreation().formatter(logEvent);
                    const name = formattedEvent.event;
                    const payerArg = formattedEvent.args.payer;
                    const firstBeneficiaryArg = formattedEvent.args.firstBeneficiary;
                    const secondBeneficiaryArg = formattedEvent.args.secondBeneficiary;
                    assert.equal(name, "LogCreation", "LogCreation name is wrong");
                    assert.equal(payerArg, payer, "LogCreation arg payer is wrong: " + payerArg);
                    assert.equal(firstBeneficiaryArg, firstBeneficiary,
                        "LogCreation arg firstBeneficiary is wrong: " + firstBeneficiaryArg);
                    assert.equal(secondBeneficiaryArg, secondBeneficiary,
                        "LogCreation arg secondBeneficiary is wrong: " + secondBeneficiaryArg);
                    assert.equal(Object.keys(formattedEvent.args).length + 1, EXPECTED_TOPIC_LENGTH);
                });

        });
    });
});
