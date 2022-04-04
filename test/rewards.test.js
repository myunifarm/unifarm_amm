const { use, expect } = require('chai')
const { ethers, waffle } = require('hardhat')
const { solidity } = waffle

use(solidity)

const { encodeParameters } = require('./utils/Ethereum')
const { expandTo18Decimals } = require('./utils/utilities')

async function enfranchise(ufarm, actor, amount) {
  await ufarm.transfer(actor.address, expandTo18Decimals(amount))
  await ufarm.connect(actor).delegate(actor.address)
}
const ABI = ['function setPendingAdmin(address pendingAdmin_)']
const delay = 259200 //3 days

describe('GovernorBravo#rewards', () => {
  let root, a1, a2, accounts
  let ufarm
  let gov
  let timelock
  let token
  beforeEach(async () => {
    ;[root, a1, a2, ...accounts] = await ethers.getSigners()

    const UnifarmToken = await ethers.getContractFactory('UnifarmToken')
    const GovernorBravoDelegate = await ethers.getContractFactory('GovernorBravoDelegate')
    const Timelock = await ethers.getContractFactory('Timelock')
    const Token = await ethers.getContractFactory('ERC20')

    token = await Token.deploy(expandTo18Decimals(10000))
    ufarm = await UnifarmToken.deploy()
    gov = await GovernorBravoDelegate.deploy()
    timelock = await Timelock.deploy(root.address, delay)

    await token.transfer(a1.address, expandTo18Decimals(100))
  })

  describe('overlapping actions', async () => {
    it('reverts on queueing overlapping actions in same proposal', async () => {
      //initialise
      await ufarm.__UnifarmToken_init(expandTo18Decimals('10000000000'))
      await gov
        .connect(root)
        .initialize(timelock.address, ufarm.address, 17280, 1, '100000000000000000000000', root.address)

      let iface = new ethers.utils.Interface(ABI)
      const setPendingAdminData = iface.encodeFunctionData('setPendingAdmin', [gov.address])

      const timestamp = (await ethers.provider.getBlock()).timestamp
      const eta = timestamp + delay * 2

      await timelock.connect(root).queueTransaction(timelock.address, 0, '', setPendingAdminData, eta)
      await ethers.provider.send('evm_increaseTime', [delay * 2])
      await timelock.connect(root).executeTransaction(timelock.address, 0, '', setPendingAdminData, eta)

      await gov._initiate()

      await enfranchise(ufarm, a1, 3e6)
      await ethers.provider.send('evm_mine')

      const targets = [ufarm.address, ufarm.address]
      const values = ['0', '0']
      const signatures = ['getBalanceOf(address)', 'getBalanceOf(address)']
      const calldatas = [encodeParameters(['address'], [root.address]), encodeParameters(['address'], [root.address])]

      await ufarm.delegate(a1.address)

      expect(await gov.versionRecipient()).to.equal('1')

      await expect(gov.connect(a1).propose(token.address, 0, targets, values, signatures, calldatas, 'do nothing')).to
        .be.reverted

      await gov.connect(root).updateTokenPermission(token.address, true)

      await token.connect(a1).approve(gov.address, expandTo18Decimals(10))
      await expect(
        gov
          .connect(a1)
          .propose(token.address, expandTo18Decimals(10), targets, values, signatures, calldatas, 'do nothing')
      ).to.emit(gov, 'ProposalCreated')

      proposalId = await gov.latestProposalIds(a1.address)

      await ethers.provider.send('evm_mine')

      await expect(gov.connect(a1).castVote(proposalId, 1)).to.emit(gov, 'VoteCast')

      await expect(gov.connect(a2).castVoteWithReason(proposalId, 1, '')).to.emit(gov, 'VoteCast')

      await expect(gov.connect(root)._setVotingDelay(17290)).to.emit(gov, 'VotingDelaySet')

      await expect(gov.connect(root)._setVotingPeriod(5770)).to.emit(gov, 'VotingPeriodSet')

      await expect(gov.connect(root)._setProposalThreshold('60000000000000000000000')).to.emit(
        gov,
        'ProposalThresholdSet'
      )

      await expect(gov.connect(root)._setPendingAdmin(a1.address)).to.emit(gov, 'NewPendingAdmin')

      await expect(gov.connect(a1)._acceptAdmin())
        .to.emit(gov, 'NewAdmin')
        .to.emit(gov, 'NewPendingAdmin')

      await expect(gov.connect(a1).cancel(proposalId))
        .to.emit(gov, 'ProposalCanceled')
        .to.emit(gov, 'ProposalCanceled')

      await gov.getActions(proposalId)

      const currentBlock = (await ethers.provider.getBlock()).timestamp
      await ethers.provider.send('evm_mine', [currentBlock + 4000])

      await expect(gov.queue(proposalId)).to.be.revertedWith(
        'GovernorBravo::queue: proposal can only be queued if it is succeeded'
      )

      await ethers.provider.send('evm_mine')
    })
  })
})
