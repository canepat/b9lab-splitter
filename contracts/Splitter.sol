pragma solidity ^0.4.13;

contract Splitter {
    event LogCreation(address indexed owner);
    event LogClosed(address indexed caller);
    event LogSplitted(address indexed first, address indexed second, uint256 indexed amount);
    event LogWithdraw(address indexed beneficiary, uint256 indexed amount);
    event LogDeposit(address indexed sender, uint256 indexed amount);

    address public owner;
    mapping(address => uint256) public balances;
    bool public closed;

    modifier onlyOwner {
        require(msg.sender == owner);
        _;
    }

    modifier notClosed {
        require(!closed);
        _;
    }

    function Splitter() {
        owner = msg.sender;

        LogCreation(msg.sender);
    }

    function close() public notClosed onlyOwner {
        closed = true;

        LogClosed(msg.sender);
    }

    function split(address firstBeneficiary, address secondBeneficiary) public notClosed payable {
        require(firstBeneficiary != address(0));
        require(secondBeneficiary != address(0));
        require(msg.value != 0);

        uint256 remainder = msg.value % 2;

        uint256 half = (msg.value - remainder) / 2;

        balances[msg.sender] += remainder;
        balances[firstBeneficiary] += half;
        balances[secondBeneficiary] += half;

        LogSplitted(firstBeneficiary, secondBeneficiary, half);
    }

    function withdraw() public notClosed {
        require(balances[msg.sender] != 0);

        uint256 amount = balances[msg.sender];

        balances[msg.sender] = 0;
        
        msg.sender.transfer(amount);

        LogWithdraw(msg.sender, amount);   
    }

    function () public payable {
        revert();
    }
}