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
        return Splitter.new(payer, { from: owner, gas: MAX_GAS })
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
        it("should have emitted LogCreation event", function() {
            this.slow(slowDuration);

            return web3.eth.getTransactionReceiptMined(instance.transactionHash)
                .then(function(receipt) {
                    const EXPECTED_TOPIC_LENGTH = 2;
                    assert.equal(receipt.logs.length, 1); // just 1 LogCreation event

                    const logEvent = receipt.logs[0];
                    assert.equal(logEvent.topics[0], web3.sha3("LogCreation(address)"));
                    assert.equal(logEvent.topics.length, EXPECTED_TOPIC_LENGTH);

                    const formattedEvent = instance.LogCreation().formatter(logEvent);
                    const name = formattedEvent.event;
                    const payerArg = formattedEvent.args.payer;
                    assert.equal(name, "LogCreation", "LogCreation name is wrong");
                    assert.equal(payerArg, payer, "LogCreation arg payer is wrong: " + payerArg);
                    assert.equal(Object.keys(formattedEvent.args).length + 1, EXPECTED_TOPIC_LENGTH);
                });
        });
    });

    describe("setPayer()", function() {
        it("should fail if already closed", function() {
            this.slow(slowDuration);

            return instance.close({ from : owner, gas: MAX_GAS })
                .then(txObj => web3.eth.getTransactionReceiptMined(txObj.tx))
                .then(function() {
                    return web3.eth.expectedExceptionPromise(
                        function() {
                            return instance.setPayer(firstBeneficiary, { from : owner, gas: MAX_GAS });
                        },
                        MAX_GAS
                    );
                });
        });
        it("should fail if called by not owner", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return instance.setPayer(firstBeneficiary, { from : secondBeneficiary, gas: MAX_GAS });
                },
                MAX_GAS
            );
        });
        it("should fail if new payer address is zero", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return instance.setPayer(0, { from : owner, gas: MAX_GAS });
                },
                MAX_GAS
            );
        });
        it("should fail if new payer is equal to current payer", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return instance.setPayer(payer, { from : owner, gas: MAX_GAS });
                },
                MAX_GAS
            );
        });
        it("should return provided payer", function() {
            this.slow(slowDuration);

            return web3.eth.expectedOkPromise(
                function() {
                    return instance.setPayer(firstBeneficiary, { from : owner, gas: MAX_GAS });
                },
                MAX_GAS
            )
            .then(() => instance.payer())
            .then(newPayer => assert.strictEqual(newPayer, firstBeneficiary, "provided payer not stored"));
        });
        it("should have emitted LogPayerChanged event", function() {
            this.slow(slowDuration);

            return instance.setPayer(firstBeneficiary, { from : owner, gas: MAX_GAS })
                .then(txObj => web3.eth.getTransactionReceiptMined(txObj.tx))
                .then(function(receipt) {
                    const EXPECTED_TOPIC_LENGTH = 2;
                    assert.equal(receipt.logs.length, 1); // just 1 LogPayerChanged event

                    const logEvent = receipt.logs[0];
                    assert.equal(logEvent.topics[0], web3.sha3("LogPayerChanged(address)"));
                    assert.equal(logEvent.topics.length, EXPECTED_TOPIC_LENGTH);

                    const formattedEvent = instance.LogPayerChanged().formatter(logEvent);
                    const name = formattedEvent.event;
                    const newPayerArg = formattedEvent.args.newPayer;
                    assert.equal(name, "LogPayerChanged", "LogPayerChanged name is wrong");
                    assert.equal(newPayerArg, firstBeneficiary, "LogPayerChanged arg payer is wrong: " + newPayerArg);
                    assert.equal(Object.keys(formattedEvent.args).length + 1, EXPECTED_TOPIC_LENGTH);
                });
        });
    });

    describe("split()", function() {
        it("should fail if firstBeneficiary address is zero", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return instance.split(0, secondBeneficiary, { from : payer, gas: MAX_GAS });
                },
                MAX_GAS
            );
        });
        it("should fail if secondBeneficiary address is zero", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return instance.split(firstBeneficiary, 0, { from : payer, gas: MAX_GAS });
                },
                MAX_GAS
            );
        });
        it("should fail if sender is not payer", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return instance.split(firstBeneficiary, 0, { from : owner, gas: MAX_GAS });
                },
                MAX_GAS
            );
        });
        it("should fail if amount is zero", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return instance.split(firstBeneficiary, secondBeneficiary, { from : payer, gas: MAX_GAS, value: 0 });
                },
                MAX_GAS
            );
        });
        [1, 10, 11, 100, 101, web3.toWei(0.9, 'ether')].forEach(amount => {
            it(`should split ${amount} WEI between beneficiaries`, function() {
                this.slow(slowDuration);

                const half = (amount - (amount % 2)) / 2;

                return web3.eth.expectedOkPromise(
                    function() {
                        return instance.split(firstBeneficiary, secondBeneficiary, { from : payer, gas: MAX_GAS, value: amount });
                    },
                    MAX_GAS
                )
                .then(() => instance.balances(payer))
                .then(payerBalance => {
                    assert.equal(payerBalance, amount % 2, "payer balance not equal to amount");
                    return instance.balances(firstBeneficiary);
                })
                .then(firstBeneficiaryBalance => {
                    assert.equal(firstBeneficiaryBalance, half, "firstBeneficiary balance is wrong");
                    return instance.balances(secondBeneficiary);
                })
                .then(secondBeneficiaryBalance => {
                    assert.equal(secondBeneficiaryBalance, half, "secondBeneficiary balance is wrong");
                });
            });
        });
        it.skip("should have emitted LogSplitted event");
    });
});
