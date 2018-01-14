pragma solidity ^0.4.13;

contract Splitter {
    event LogCreation(address indexed payer, address indexed firstBeneficiary, address indexed secondBeneficiary);
    event LogPayerChanged(address indexed newPayer);
    event LogFirstBeneficiaryChanged(address indexed newFirstBeneficiary);
    event LogSecondBeneficiaryChanged(address indexed newSecondBeneficiary);
    event LogClosed();
    event LogSplitted(uint256 indexed amount, uint256 indexed firstHalf, uint256 indexed secondHalf);

    address public owner;
    address public payer;
    address public firstBeneficiary;
    address public secondBeneficiary;
    uint256 weiSplitted;
    bool public closed;

    modifier onlyOwner {
        require(msg.sender == owner);
        _;
    }

    modifier onlyPayer {
        require(msg.sender == payer);
        _;
    }

    modifier notClosed {
        require(!closed);
        _;
    }

    function Splitter(address _payer, address _firstBeneficiary, address _secondBeneficiary) {
        require(_payer != address(0));
        require(_firstBeneficiary != address(0));
        require(_secondBeneficiary != address(0));

        payer = _payer;
        firstBeneficiary = _firstBeneficiary;
        secondBeneficiary = _secondBeneficiary;

        owner = msg.sender;

        LogCreation(payer, firstBeneficiary, secondBeneficiary);
    }

    function setPayer(address _payer) public notClosed onlyOwner {
        require(_payer != address(0));
        require(_payer != payer);

        payer = _payer;

        LogPayerChanged(payer);
    }

    function setFirstBeneficiary(address _firstBeneficiary) public notClosed onlyOwner {
        require(_firstBeneficiary != address(0));
        require(_firstBeneficiary != firstBeneficiary);

        firstBeneficiary = _firstBeneficiary;

        LogFirstBeneficiaryChanged(firstBeneficiary);
    }

    function setSecondBeneficiary(address _secondBeneficiary) public notClosed onlyOwner {
        require(_secondBeneficiary != address(0));
        require(_secondBeneficiary != secondBeneficiary);

        secondBeneficiary = _secondBeneficiary;

        LogSecondBeneficiaryChanged(secondBeneficiary);
    }

    function close() public notClosed onlyOwner {
        closed = true;

        LogClosed();
    }

    function split() public notClosed onlyPayer payable {
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