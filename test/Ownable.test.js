const { use, expect } = require('chai')
const { ethers, waffle } = require('hardhat')
const { solidity } = waffle
use(solidity)

describe('Ownable', function() {
  let owner

  beforeEach(async () => {
    permitWallet = ethers.Wallet.createRandom()
    ;[wallet, other] = await ethers.getSigners()

    const Own = await ethers.getContractFactory('Ownable')
    owner = await Own.deploy()
  })

  it('Ownership', async function() {
    expect(await owner.owner()).to.equal(wallet.address)
  })

  it('Renounce Ownership', async function() {
    await expect(owner.connect(wallet).renounceOwnership()).to.emit(owner, 'OwnershipTransferred')
  })

  it('Change Ownership', async function() {
    await expect(owner.connect(wallet).transferOwnership(other.address)).to.emit(owner, 'OwnershipTransferred')
  })
})
