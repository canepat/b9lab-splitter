const Splitter = artifacts.require("./Splitter.sol");

module.exports = function(deployer, network, accounts) {
    let owner = accounts[1];
    const payer = accounts[2];
    const firstPayee = accounts[3];
    const secondPayee = accounts[4];
    const gasLimit = 2000000;

    if (network == "ropsten") {
        owner = ""; // TODO: fill
    }
    
    deployer.deploy(Splitter, payer, firstPayee, secondPayee, {from: owner, gas: gasLimit});
};
