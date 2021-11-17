const { getNamedAccounts, getChainId, ethers } = require('hardhat')
const { deployAndVerify, store } = require('../scripts/utils')

let configs = require('../config/config')
let contracts = []

const main = async () => {
  const namedAccounts = await getNamedAccounts()
  const { deployer } = namedAccounts

  const chainId = await getChainId()
  configs = configs[chainId]

  const unifarmFactory = await deployAndVerify(
    'UnifarmFactory',
    [
      configs.feeTo,
      configs.trustedForwarder,
      configs.lpFee,
      configs.swapFee,
      configs.lpFeesInToken,
      configs.swapFeesInToken
    ],
    deployer,
    'contracts/UnifarmFactory.sol:UnifarmFactory',
    chainId
  )
  contracts.push({ unifarmFactory: unifarmFactory.address })

  let wethAddress = configs.weth
  if (wethAddress === '') {
    const weth = await deployAndVerify('WETH9', [], deployer, 'contracts/test/WETH9.sol:WETH9', chainId)
    contracts.push({ weth: weth.address })
    wethAddress = weth.address
  }

  const unifarmRouter02 = await deployAndVerify(
    'UnifarmRouter02',
    [unifarmFactory.address, wethAddress],
    deployer,
    'contracts/utility/UnifarmRouter02.sol:UnifarmRouter02',
    chainId
  )

  const multiSigWallet = await deployAndVerify(
    'MultiSigWallet',
    [configs.owners, configs.required],
    deployer,
    'contracts/utility/MultiSigWallet.sol:MultiSigWallet',
    chainId
  )

  const ammUtility = await deployAndVerify(
    'AMMUtility',
    [configs.ammUtilityFeeTo, configs.ammUtilityFee, wethAddress],
    deployer,
    'contracts/AMMUtility.sol:AMMUtility',
    chainId
  )

  const gov = await deployAndVerify(
    'GovernorBravoDelegate',
    [],
    deployer,
    'contracts/governance/GovernorBravoDelegate.sol:GovernorBravoDelegate',
    chainId
  )
  const govDelegator = await deployAndVerify(
    'GovernorBravoDelegator',
    [
      configs.timelock,
      configs.ufarm,
      configs.govDelegatorAdmin,
      gov.address,
      configs.votingPeriod,
      configs.votingDelay,
      configs.proposalThreshold,
      configs.trustedForwarder
    ],
    deployer,
    'contracts/governance/GovernorBravoDelegator.sol:GovernorBravoDelegator',
    chainId
  )

  contracts.push({ unifarmRouter02: unifarmRouter02.address })
  contracts.push({ multiSigWallet: multiSigWallet.address })
  contracts.push({ ammUtility: ammUtility.address })
  contracts.push({ gov: gov.address })
  contracts.push({ govDelegator: govDelegator.address })

  await store(contracts, chainId)
}

module.exports = main
