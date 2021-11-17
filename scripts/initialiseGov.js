const { getNamedAccounts, getChainId, ethers } = require('hardhat')
let configs = require('../config/config')

const main = async () => {
  const namedAccounts = await getNamedAccounts()
  const { admin } = namedAccounts

  const chainId = await getChainId()
  configs = configs[chainId]

  const timelock = await ethers.getContract('Timelock', admin)
  const gov = await ethers.getContract('GovernorBravoDelegate', admin)

  const iface = new ethers.utils.Interface(['function setPendingAdmin(address pendingAdmin_)'])
  const setPendingAdminData = iface.encodeFunctionData('setPendingAdmin', [gov.address])

  const timestamp = (await ethers.provider.getBlock()).timestamp
  const eta = timestamp + configs.timelockDelay

  await timelock.executeTransaction(timelock.address, 0, '', setPendingAdminData, eta)
  await gov._initiate()
}

module.exports = main
