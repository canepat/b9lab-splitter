# b9lab-splitter
Splitter Smart Contract - B9Lab Course Practice

### Overview: 
You will create a smart contract named Splitter whereby:
* there are three people: Alice, Bob and Carol
* we can see the balance of the Splitter contract on the web page
* whenever Alice sends ether to the contract, half of it goes to Bob and the other half to Carol
* we can see the balances of Alice, Bob and Carol on the web page
* we can send ether to it from the web page

### Stretch goals:
* add a kill switch to the whole contract
* make the contract a utility that can be used by David, Emma and anybody with an address
* cover potentially bad input data

### Implementation:
The following implementation choices has been made not explicitly required by spec:
* explicit check on payer for splitting, no one else can call split
* withdraw pattern for splitted payments
* free contribution with fallback function also for payer

### Limitations:
The following limitations currently apply:
* no check for arithmetic overflow
* no web page
