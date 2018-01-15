pragma solidity ^0.4.13;

contract Splitter {
    event LogCreation(address indexed payer);
    event LogPayerChanged(address indexed newPayer);
    event LogClosed();
    event LogSplitted(uint256 indexed amount, uint256 indexed firstHalf, uint256 indexed secondHalf);

    address public owner;
    address public payer;
    uint256 weiSplitted;
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
        firstBeneficiary.transfer(firstHalf);

        uint256 secondHalf = msg.value - firstHalf;
        secondBeneficiary.transfer(secondHalf);

        weiSplitted += msg.value;

        LogSplitted(msg.value, firstHalf, secondHalf);
    }

    function () public {
        revert();
    }
}