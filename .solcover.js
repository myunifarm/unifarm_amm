module.exports = {
  // Reentrancy Guard is copied from @openzeppelin/contracts
  // AMM utility ropsten tests for swaps are included in scripts/0x-ropsten-test and others are in test folder
  skipFiles: ['test/', 'libraries/', 'utility/AMMUtility.sol', 'utility/ReentrancyGuard.sol', '/BaseRelayRecipient.sol']
}
