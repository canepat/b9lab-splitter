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
    const AMOUNT = web3.toWei(0.9, 'ether');

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
                    return Splitter.new(0, beneficiary1, beneficiary2, { from: owner, gas: MAX_GAS });
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
                            return instance.setPayer(beneficiary1, { from: owner, gas: MAX_GAS });
                        },
                        MAX_GAS
                    );
                });
        });
        it("should fail if called by not owner", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return instance.setPayer(beneficiary1, { from: beneficiary2, gas: MAX_GAS });
                },
                MAX_GAS
            );
        });
        it("should fail if new payer address is zero", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return instance.setPayer(0, { from: owner, gas: MAX_GAS });
                },
                MAX_GAS
            );
        });
        it("should fail if new payer is equal to current payer", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return instance.setPayer(payer, { from: owner, gas: MAX_GAS });
                },
                MAX_GAS
            );
        });
        it("should return provided payer", function() {
            this.slow(slowDuration);

            return web3.eth.expectedOkPromise(
                function() {
                    return instance.setPayer(beneficiary1, { from: owner, gas: MAX_GAS });
                },
                MAX_GAS
            )
            .then(() => instance.payer())
            .then(newPayer => assert.strictEqual(newPayer, beneficiary1, "provided payer not stored"));
        });
        it("should have emitted LogPayerChanged event", function() {
            this.slow(slowDuration);

            return instance.setPayer(beneficiary1, { from: owner, gas: MAX_GAS })
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
                    assert.equal(newPayerArg, beneficiary1, "LogPayerChanged arg payer is wrong: " + newPayerArg);
                    assert.equal(Object.keys(formattedEvent.args).length + 1, EXPECTED_TOPIC_LENGTH);
                });
        });
    });

    describe("close()", function() {
        it("should fail if already closed", function() {
            this.slow(slowDuration);

            return instance.close({ from : owner, gas: MAX_GAS })
                .then(txObj => web3.eth.getTransactionReceiptMined(txObj.tx))
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
                .then(txObj => web3.eth.getTransactionReceiptMined(txObj.tx))
                .then(function(receipt) {
                    const EXPECTED_TOPIC_LENGTH = 1;
                    assert.equal(receipt.logs.length, 1); // just 1 LogClosed event

                    const logEvent = receipt.logs[0];
                    assert.equal(logEvent.topics[0], web3.sha3("LogClosed()"));
                    assert.equal(logEvent.topics.length, EXPECTED_TOPIC_LENGTH);

                    const EXPECTED_ARG_LENGTH = 0;
                    const formattedEvent = instance.LogClosed().formatter(logEvent);
                    const name = formattedEvent.event;
                    assert.equal(name, "LogClosed", "LogClosed name is wrong");
                    assert.equal(Object.keys(formattedEvent.args).length, EXPECTED_ARG_LENGTH);
                });
        });
    });

    describe("split()", function() {
        it("should fail if already closed", function() {
            this.slow(slowDuration);

            return instance.close({ from : owner, gas: MAX_GAS })
                .then(txObj => web3.eth.getTransactionReceiptMined(txObj.tx))
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
                    return instance.split(0, beneficiary2, { from: payer, gas: MAX_GAS });
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
        it("should fail if sender is not payer", function() {
            this.slow(slowDuration);

            return web3.eth.expectedExceptionPromise(
                function() {
                    return instance.split(beneficiary1, 0, { from: owner, gas: MAX_GAS });
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

                const half = (weiAmount - (weiAmount % 2)) / 2;

                return web3.eth.expectedOkPromise(
                    function() {
                        return instance.split(beneficiary1, beneficiary2, { from: payer, gas: MAX_GAS, value: weiAmount });
                    },
                    MAX_GAS
                )
                .then(() => instance.balances(payer))
                .then(payerBalance => {
                    assert.equal(payerBalance, weiAmount % 2, "payer balance not equal to amount");
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
                .then(txObj => web3.eth.getTransactionReceiptMined(txObj.tx))
                .then(function(receipt) {
                    const EXPECTED_TOPIC_LENGTH = 4;
                    assert.equal(receipt.logs.length, 1); // just 1 LogSplitted event

                    const logEvent = receipt.logs[0];
                    assert.equal(logEvent.topics[0], web3.sha3("LogSplitted(address,address,uint256)"));
                    assert.equal(logEvent.topics.length, EXPECTED_TOPIC_LENGTH);

                    const EXPECTED_ARG_LENGTH = 3;
                    const formattedEvent = instance.LogSplitted().formatter(logEvent);
                    const name = formattedEvent.event;
                    const firstArg = formattedEvent.args.first;
                    const secondArg = formattedEvent.args.second;
                    const amountArg = formattedEvent.args.amount;
                    assert.equal(name, "LogSplitted", "LogSplitted name is wrong");
                    assert.equal(firstArg, beneficiary1, "LogSplitted arg first is wrong: " + firstArg);
                    assert.equal(secondArg, beneficiary2, "LogSplitted arg second is wrong: " + secondArg);
                    assert.equal(amountArg, AMOUNT, "LogSplitted arg amount is wrong: " + amountArg);
                    assert.equal(Object.keys(formattedEvent.args).length, EXPECTED_ARG_LENGTH);
                });
        });
    });

    describe("withdraw()", function() {
        it("should fail if already closed", function() {
            this.slow(slowDuration);

            return instance.split(beneficiary1, beneficiary2, { from: payer, gas: MAX_GAS, value: 2*AMOUNT })
                .then(txObj => web3.eth.getTransactionReceiptMined(txObj.tx))
                .then(() => instance.close({ from: owner, gas: MAX_GAS }))
                .then(txObj => web3.eth.getTransactionReceiptMined(txObj.tx))
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
                .then(txObj => web3.eth.getTransactionReceiptMined(txObj.tx))
                .then(() => instance.withdraw({ from: beneficiary1, gas: MAX_GAS }))
                .then(txObj => web3.eth.getTransactionReceiptMined(txObj.tx))
                .then(() => instance.balances(beneficiary1))
                .then(balance1 => assert.equal(balance1, 0, "beneficiary1 balance not zero"))
                .then(() => instance.withdraw({ from: beneficiary2, gas: MAX_GAS }))
                .then(txObj => web3.eth.getTransactionReceiptMined(txObj.tx))
                .then(() => instance.balances(beneficiary2))
                .then(balance2 => assert.equal(balance2, 0, "beneficiary2 balance not zero"));
        });
        it("should increase caller balance", function() {
            this.slow(slowDuration);

            let balance1Before, balance2Before, gasPrice, withdraw1TxCost, withdraw2TxCost;
            return instance.split(beneficiary1, beneficiary2, { from: payer, gas: MAX_GAS, value: 2*AMOUNT })
                .then(txObj => web3.eth.getTransactionReceiptMined(txObj.tx))
                
                .then(() => web3.eth.getBalancePromise(beneficiary1))
                .then(balance1 => balance1Before = balance1)
                .then(() => instance.withdraw({ from: beneficiary1, gas: MAX_GAS }))
                .then(txObj => web3.eth.getTransaction(txObj.tx))
                .then(tx => {
                    gasPrice = tx.gasPrice;
                    return web3.eth.getTransactionReceiptMined(tx.hash);
                })
                .then(receipt => {
                    withdraw1TxCost = gasPrice * receipt.gasUsed;
                    return web3.eth.getBalancePromise(beneficiary1);
                })
                .then(balance1 => {
                    const balance1Diff = balance1.minus(balance1Before).plus(withdraw1TxCost);
                    assert.equal(balance1Diff, AMOUNT, "beneficiary1 balance not increased")
                })

                .then(() => web3.eth.getBalancePromise(beneficiary2))
                .then(balance2 => balance2Before = balance2)
                .then(() => instance.withdraw({ from: beneficiary2, gas: MAX_GAS }))
                .then(txObj => web3.eth.getTransaction(txObj.tx))
                .then(tx => {
                    gasPrice = tx.gasPrice;
                    return web3.eth.getTransactionReceiptMined(tx.hash);
                })
                .then(receipt => {
                    withdraw2TxCost = gasPrice * receipt.gasUsed;
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
                .then(txObj => web3.eth.getTransactionReceiptMined(txObj.tx))
                .then(() => instance.withdraw({ from: beneficiary1, gas: MAX_GAS }))
                .then(txObj => web3.eth.getTransactionReceiptMined(txObj.tx))
                .then(function(receipt) {
                    const EXPECTED_TOPIC_LENGTH = 3;
                    assert.equal(receipt.logs.length, 1); // just 1 LogWithdraw event

                    const logEvent = receipt.logs[0];
                    assert.equal(logEvent.topics[0], web3.sha3("LogWithdraw(address,uint256)"));
                    assert.equal(logEvent.topics.length, EXPECTED_TOPIC_LENGTH);

                    const EXPECTED_ARG_LENGTH = 2;
                    const formattedEvent = instance.LogWithdraw().formatter(logEvent);
                    const name = formattedEvent.event;
                    const beneficiaryArg = formattedEvent.args.beneficiary;
                    const amountArg = formattedEvent.args.amount;
                    assert.equal(name, "LogWithdraw", "LogWithdraw name is wrong");
                    assert.equal(beneficiaryArg, beneficiary1, "LogWithdraw arg beneficiary is wrong: " + beneficiaryArg);
                    assert.equal(amountArg, AMOUNT, "LogWithdraw arg amount is wrong: " + amountArg);
                    assert.equal(Object.keys(formattedEvent.args).length, EXPECTED_ARG_LENGTH);
                });
        });
    });
});
