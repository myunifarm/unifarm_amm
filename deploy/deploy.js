const { getNamedAccounts, getChainId, ethers } = require('hardhat')
const { deployAndVerify, store, sleep } = require('../scripts/utils')

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
      configs.feeTo || deployer,
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
    [configs.owners || [deployer], configs.required],
    deployer,
    'contracts/utility/MultiSigWallet.sol:MultiSigWallet',
    chainId
  )

  const ammUtility = await deployAndVerify(
    'AMMUtility',
    [configs.ammUtilityFeeTo || deployer, configs.ammUtilityFee, wethAddress],
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

  let timelock = configs.timelock
  let ufarm = configs.ufarm

  if (!timelock) {
    const timelockContract = await deployAndVerify(
      'Timelock',
      [configs.admin || deployer, configs.timelockDelay],
      deployer,
      'contracts/test/Timelock.sol:Timelock',
      chainId
    )

    timelock = timelockContract.address
  }

  if (!ufarm) {
    const ufarmContract = await deployAndVerify(
      'UnifarmToken',
      [],
      deployer,
      'contracts/test/UnifarmToken.sol:UnifarmToken',
      chainId
    )

    await (await ethers.getContract('UnifarmToken')).__UnifarmToken_init(configs.ufarmInitialSupply)
    await sleep(30)
    ufarm = ufarmContract.address
  }

  const govDelegator = await deployAndVerify(
    'GovernorBravoDelegator',
    [
      timelock,
      ufarm,
      configs.govDelegatorAdmin || deployer,
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

  //set governance as timelock admin
  const iface = new ethers.utils.Interface(['function setPendingAdmin(address pendingAdmin_)'])
  const setPendingAdminData = iface.encodeFunctionData('setPendingAdmin', [gov.address])

  const timestamp = (await ethers.provider.getBlock()).timestamp
  const eta = timestamp + configs.timelockDelay

  await (await ethers.getContract('Timelock')).queueTransaction(timelock, 0, '', setPendingAdminData, eta)

  contracts.push({ unifarmRouter02: unifarmRouter02.address })
  contracts.push({ multiSigWallet: multiSigWallet.address })
  contracts.push({ ammUtility: ammUtility.address })
  contracts.push({ gov: gov.address })
  contracts.push({ govDelegator: govDelegator.address })

  await store(contracts, chainId)
}

module.exports = main
