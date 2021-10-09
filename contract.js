const Web3 = require('web3');
const abi = require('./abi.json');

function useContract(url, address) {
  const web3 = new Web3(new Web3.providers.HttpProvider(url));
  return new web3.eth.Contract(JSON.parse(abi.result), address);
}

module.exports = useContract;
