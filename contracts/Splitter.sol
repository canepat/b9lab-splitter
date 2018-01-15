pragma solidity ^0.4.13;

contract Splitter {
    event LogCreation(address indexed payer);
    event LogPayerChanged(address indexed newPayer);
    event LogClosed();
    event LogSplitted(uint256 indexed amount, uint256 indexed firstHalf, uint256 indexed secondHalf);
    event LogWithdraw(address indexed beneficiary, uint256 indexed amount);
    event LogDeposit(address indexed sender, uint256 indexed amount);

    address public owner;
    mapping(address => uint256) public balances;
    address public payer;
    bool public closed;

    modifier onlyOwner {
        require(msg.sender == owner);
        _;
    }

    modifier notClosed {
        require(!closed);
        _;
    }

    function Splitter(address _payer) {
        require(_payer != address(0));

        payer = _payer;

        owner = msg.sender;

        LogCreation(payer);
    }

    function setPayer(address _payer) public notClosed onlyOwner {
        require(_payer != address(0));
        require(_payer != payer);

        payer = _payer;

        LogPayerChanged(payer);
    }

    function close() public notClosed onlyOwner {
        closed = true;

        LogClosed();
    }

    function split(address firstBeneficiary, address secondBeneficiary) public notClosed payable {
        require(firstBeneficiary != address(0));
        require(secondBeneficiary != address(0));
        require(msg.sender == payer);
        require(msg.value != 0);

        uint256 firstHalf = msg.value / 2;
        uint256 secondHalf = msg.value - firstHalf;

        balances[msg.sender] = msg.value;
        balances[firstBeneficiary] = firstHalf;
        balances[secondBeneficiary] = secondHalf;

        LogSplitted(msg.value, firstHalf, secondHalf);
    }

    function withdraw() public notClosed {
        uint256 amount = balances[msg.sender];
        
        require(amount != 0);
        
        balances[msg.sender] = 0;
        
        msg.sender.transfer(amount);

        LogWithdraw(msg.sender, amount);   
    }

    function () public notClosed payable {
        require(msg.sender != payer);

        LogDeposit(msg.sender, msg.value);
    }
}