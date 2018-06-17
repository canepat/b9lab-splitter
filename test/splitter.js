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
    const MAX_GAS               = 2000000;
    const TESTRPC_SLOW_DURATION = 5000;
    const GETH_SLOW_DURATION    = 60000;

    const AMOUNT = web3.toWei(0.009, 'ether');

    let isTestRPC, isGeth, slowDuration;
    before("should identify node", function() {
        return web3.version.getNodePromise()
            .then(function(node) {
                isTestRPC = node.indexOf("EthereumJS TestRPC") >= 0;
                isGeth = node.indexOf("Geth") >= 0;
                slowDuration = isTestRPC ? TESTRPC_SLOW_DURATION : GETH_SLOW_DURATION;
            });
    });

    let coinbase, owner, payer, beneficiary1, beneficiary2;
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
                [owner, payer, beneficiary1, beneficiary2] = accounts;
                return web3.eth.makeSureAreUnlocked(accounts);
            })
            .then(function() {
                const initial_balance = web3.toWei(1, 'ether');
                return web3.eth.makeSureHasAtLeast(coinbase, [owner, payer, beneficiary1, beneficiary2], initial_balance)
                    .then(txObj => web3.eth.getTransactionReceiptMined(txObj));
            });
    });

    let instance;
    beforeEach("should deploy a Splitter instance", function() {
        return Splitter.new({ from: owner, gas: MAX_GAS })
            .then(function(_instance) {
                instance = _instance;
            });
    });

    describe("#Splitter()", function() {
        it("should be owned by expected owner", function() {
            this.slow(slowDuration);

            return instance.owner()
                .then(realOwner => assert.strictEqual(owner, realOwner, "not owned by expected owner"));
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
                    const ownerArg = formattedEvent.args.owner;
                    assert.equal(name, "LogCreation", "LogCreation name is wrong");
                    assert.equal(ownerArg, owner, "LogCreation arg owner is wrong: " + ownerArg);
                    assert.equal(Object.keys(formattedEvent.args).length + 1, EXPECTED_TOPIC_LENGTH);
                });
        });
    });

    describe("#close()", function() {
        it("should fail if already closed", function() {
            this.slow(slowDuration);

            return instance.close({ from : owner, gas: MAX_GAS })
                .then(function() {
                    return web3.eth.expectedExceptionPromise(
                        function() {
                            return instance.close({ from: owner, gas: MAX_GAS });
                        },
                        MAX_GAS
                    );
                });
        });
        it("should fail if called by not owner", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return instance.close({ from: beneficiary2, gas: MAX_GAS });
                },
                MAX_GAS
            );
        });
        it("should be closed after successful close", function() {
            this.slow(slowDuration);

            return web3.eth.expectedOkPromise(
                function() {
                    return instance.close({ from : owner, gas: MAX_GAS });
                },
                MAX_GAS
            )
            .then(() => instance.closed())
            .then(isClosed => assert.isTrue(isClosed, "not closed after successful close"));
        });
        it("should have emitted LogClosed event", function() {
            this.slow(slowDuration);

            return instance.close({ from : owner, gas: MAX_GAS })
                .then(txObj => {
                    assert.isAtMost(txObj.logs.length, txObj.receipt.logs.length);
                    assert.equal(txObj.logs.length, 1); // just 1 LogClosed event
                    assert.equal(txObj.receipt.logs.length, 1); // just 1 LogClosed event

                    const EXPECTED_ARG_LENGTH = 1;
                    const txLogEvent = txObj.logs[0];
                    const eventName = txLogEvent.event;
                    const callerArg = txLogEvent.args.caller;
                    assert.equal(eventName, "LogClosed", "LogClosed name is wrong");
                    assert.equal(callerArg, owner, "LogClosed arg caller is wrong: " + callerArg);
                    assert.equal(Object.keys(txLogEvent.args).length, EXPECTED_ARG_LENGTH);

                    const EXPECTED_TOPIC_LENGTH = 2;
                    const receiptRawLogEvent = txObj.receipt.logs[0];
                    assert.equal(receiptRawLogEvent.topics[0], web3.sha3("LogClosed(address)"));
                    assert.equal(receiptRawLogEvent.topics.length, EXPECTED_TOPIC_LENGTH);

                    const receiptLogEvent = instance.LogClosed().formatter(receiptRawLogEvent);
                    assert.deepEqual(receiptLogEvent, txLogEvent, "LogClosed receipt event is different from tx event");
                });
        });
    });

    describe("#split()", function() {
        it("should fail if already closed", function() {
            this.slow(slowDuration);

            return instance.close({ from : owner, gas: MAX_GAS })
                .then(function() {
                    return web3.eth.expectedExceptionPromise(
                        function() {
                            return instance.split(beneficiary1, beneficiary2, { from: payer, gas: MAX_GAS, value: 2*AMOUNT });
                        },
                        MAX_GAS
                    );
                });
        });
        it("should fail if beneficiary1 address is zero", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return instance.split(0, beneficiary2, { from: payer, gas: MAX_GAS, value: 2*AMOUNT });
                },
                MAX_GAS
            );
        });
        it("should fail if beneficiary2 address is zero", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return instance.split(beneficiary1, 0, { from: payer, gas: MAX_GAS });
                },
                MAX_GAS
            );
        });
        it("should fail if amount is zero", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return instance.split(beneficiary1, beneficiary2, { from: payer, gas: MAX_GAS, value: 0 });
                },
                MAX_GAS
            );
        });
        [1, 10, 11, 100, 101, web3.toWei(0.9, 'ether')].forEach(weiAmount => {
            it(`should split ${weiAmount} WEI between beneficiaries`, function() {
                this.slow(slowDuration);

                const remainder = weiAmount % 2;
                const half = (weiAmount - remainder) / 2;

                return web3.eth.expectedOkPromise(
                    function() {
                        return instance.split(beneficiary1, beneficiary2, { from: payer, gas: MAX_GAS, value: weiAmount });
                    },
                    MAX_GAS
                )
                .then(() => instance.balances(payer))
                .then(payerBalance => {
                    assert.equal(payerBalance, remainder, "payer balance not equal to amount");
                    return instance.balances(beneficiary1);
                })
                .then(beneficiary1Balance => {
                    assert.equal(beneficiary1Balance, half, "beneficiary1 balance is wrong");
                    return instance.balances(beneficiary2);
                })
                .then(beneficiary2Balance => {
                    assert.equal(beneficiary2Balance, half, "beneficiary2 balance is wrong");
                });
            });
        });
        it("should have emitted LogSplitted event", function() {
            this.slow(slowDuration);

            return instance.split(beneficiary1, beneficiary2, { from: payer, gas: MAX_GAS, value: 2*AMOUNT })
                .then(txObj => {
                    assert.isAtMost(txObj.logs.length, txObj.receipt.logs.length);
                    assert.equal(txObj.logs.length, 1); // just 1 LogSplitted event
                    assert.equal(txObj.receipt.logs.length, 1); // just 1 LogSplitted event

                    const EXPECTED_ARG_LENGTH = 3;
                    const txLogEvent = txObj.logs[0];
                    const eventName = txLogEvent.event;
                    const first = txLogEvent.args.first;
                    const second = txLogEvent.args.second;
                    const amount = txLogEvent.args.amount;
                    assert.equal(eventName, "LogSplitted", "LogSplitted event name is wrong");
                    assert.equal(first, beneficiary1, "LogSplitted arg first is wrong: " + first);
                    assert.equal(second, beneficiary2, "LogSplitted arg second is wrong: " + second);
                    assert.equal(amount, AMOUNT, "LogSplitted arg amount is wrong: " + amount);

                    const EXPECTED_TOPIC_LENGTH = 4;
                    const receiptRawLogEvent = txObj.receipt.logs[0];
                    assert.equal(receiptRawLogEvent.topics[0], web3.sha3("LogSplitted(address,address,uint256)"));
                    assert.equal(receiptRawLogEvent.topics.length, EXPECTED_TOPIC_LENGTH);

                    const receiptLogEvent = instance.LogSplitted().formatter(receiptRawLogEvent);
                    assert.deepEqual(receiptLogEvent, txLogEvent, "LogSplitted receipt event is different from tx event");
                });
        });
    });

    describe("#withdraw()", function() {
        it("should fail if already closed", function() {
            this.slow(slowDuration);

            return instance.split(beneficiary1, beneficiary2, { from: payer, gas: MAX_GAS, value: 2*AMOUNT })
                .then(() => instance.close({ from: owner, gas: MAX_GAS }))
                .then(function() {
                    return web3.eth.expectedExceptionPromise(
                        function() {
                            return instance.withdraw({ from: beneficiary1, gas: MAX_GAS });
                        },
                        MAX_GAS
                    );
                });
        });
        it("should fail if caller deposit is zero", function() {
            this.slow(slowDuration);

            return instance.balances(owner)
                .then(balance => assert.equal(balance, 0, "caller deposit is not zero"))
                .then(function() {
                    return web3.eth.expectedExceptionPromise(
                        function() {
                            return instance.withdraw({ from: owner, gas: MAX_GAS });
                        },
                        MAX_GAS
                    );
                });
        });
        it("should clear caller deposit", function() {
            this.slow(slowDuration);

            return instance.split(beneficiary1, beneficiary2, { from: payer, gas: MAX_GAS, value: 2*AMOUNT })
                .then(() => instance.withdraw({ from: beneficiary1, gas: MAX_GAS }))
                .then(() => instance.balances(beneficiary1))
                .then(balance1 => assert.equal(balance1, 0, "beneficiary1 balance not zero"))
                .then(() => instance.withdraw({ from: beneficiary2, gas: MAX_GAS }))
                .then(() => instance.balances(beneficiary2))
                .then(balance2 => assert.equal(balance2, 0, "beneficiary2 balance not zero"));
        });
        it("should increase caller balance", function() {
            this.slow(slowDuration);

            let balance1Before, balance2Before, txObj, gasPrice, withdraw1TxCost, withdraw2TxCost;
            return instance.split(beneficiary1, beneficiary2, { from: payer, gas: MAX_GAS, value: 2*AMOUNT })
                .then(() => web3.eth.getBalancePromise(beneficiary1))
                .then(balance1 => balance1Before = balance1)
                .then(() => instance.withdraw({ from: beneficiary1, gas: MAX_GAS }))
                .then(_txObj => {
                    txObj = _txObj;
                    return web3.eth.getTransactionPromise(txObj.tx);
                })
                .then(tx => {
                    gasPrice = tx.gasPrice;
                    withdraw1TxCost = gasPrice * txObj.receipt.gasUsed;
                    return web3.eth.getBalancePromise(beneficiary1);
                })
                .then(balance1 => {
                    const balance1Diff = balance1.minus(balance1Before).plus(withdraw1TxCost);
                    assert.equal(balance1Diff, AMOUNT, "beneficiary1 balance not increased")
                })
                .then(() => web3.eth.getBalancePromise(beneficiary2))
                .then(balance2 => balance2Before = balance2)
                .then(() => instance.withdraw({ from: beneficiary2, gas: MAX_GAS }))
                .then(_txObj => {
                    txObj = _txObj;
                    return web3.eth.getTransactionPromise(txObj.tx);
                })
                .then(tx => {
                    gasPrice = tx.gasPrice;
                    withdraw2TxCost = gasPrice * txObj.receipt.gasUsed;
                    return web3.eth.getBalancePromise(beneficiary2);
                })
                .then(balance2 => {
                    const balance2Diff = balance2.minus(balance2Before).plus(withdraw2TxCost);
                    assert.equal(balance2Diff, AMOUNT, "beneficiary2 balance not increased")
                });
        });
        it("should have emitted LogWithdraw event", function() {
            this.slow(slowDuration);

            return instance.split(beneficiary1, beneficiary2, { from: payer, gas: MAX_GAS, value: 2*AMOUNT })
                .then(() => instance.withdraw({ from: beneficiary1, gas: MAX_GAS }))
                .then(txObj => {
                    assert.isAtMost(txObj.logs.length, txObj.receipt.logs.length);
                    assert.equal(txObj.logs.length, 1); // just 1 LogWithdraw event
                    assert.equal(txObj.receipt.logs.length, 1); // just 1 LogWithdraw event

                    const EXPECTED_ARG_LENGTH = 2;
                    const txLogEvent = txObj.logs[0];
                    const eventName = txLogEvent.event;
                    const beneficiaryArg = txLogEvent.args.beneficiary;
                    const amountArg = txLogEvent.args.amount;
                    assert.equal(eventName, "LogWithdraw", "LogWithdraw name is wrong");
                    assert.equal(beneficiaryArg, beneficiary1, "LogWithdraw arg beneficiary is wrong: " + beneficiaryArg);
                    assert.equal(amountArg, AMOUNT, "LogWithdraw arg amount is wrong: " + amountArg);
                    assert.equal(Object.keys(txLogEvent.args).length, EXPECTED_ARG_LENGTH);

                    const EXPECTED_TOPIC_LENGTH = 3;
                    const receiptRawLogEvent = txObj.receipt.logs[0];
                    assert.equal(receiptRawLogEvent.topics[0], web3.sha3("LogWithdraw(address,uint256)"));
                    assert.equal(receiptRawLogEvent.topics.length, EXPECTED_TOPIC_LENGTH);

                    const receiptLogEvent = instance.LogWithdraw().formatter(receiptRawLogEvent);
                    assert.deepEqual(receiptLogEvent, txLogEvent, "LogWithdraw receipt event is different from tx event");
                });
        });
    });

    describe("#()", function() {
        it("should fail whenever is called", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return instance.sendTransaction({ from: payer, gas: MAX_GAS, value: 2*AMOUNT });
                },
                MAX_GAS
            );
        });
    });
});