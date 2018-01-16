pragma solidity ^0.4.13;

contract Splitter {
    event LogCreation(address indexed payer);
    event LogPayerChanged(address indexed newPayer);
    event LogClosed();
    event LogSplitted(address indexed first, address indexed second, uint256 indexed amount);
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

        uint256 half = (msg.value - (msg.value % 2)) / 2;

        balances[msg.sender] += msg.value % 2;
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

    function () public notClosed payable {
        LogDeposit(msg.sender, msg.value);
    }
}