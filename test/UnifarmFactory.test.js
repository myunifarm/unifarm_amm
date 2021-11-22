const { use, expect } = require('chai')
const { ethers, waffle } = require('hardhat')
const { solidity } = waffle

use(solidity)

const TEST_ADDRESSES = ['0x1000000000000000000000000000000000000000', '0x2000000000000000000000000000000000000000']

describe('UnifarmFactory', () => {
  let wallet, other, trustedForwarder
  let factory
  let lpFee = 2
  let swapFee = 2
  let lpFeesInToken = true
  let swapFeesInToken = true

  beforeEach(async () => {
    ;[wallet, other, trustedForwarder] = await ethers.getSigners()

    const Factory = await ethers.getContractFactory('UnifarmFactory')
    factory = await Factory.deploy(
      wallet.address,
      trustedForwarder.address,
      lpFee,
      swapFee,
      lpFeesInToken,
      swapFeesInToken
    )
  })

  it('feeTo, feeToSetter, allPairsLength', async () => {
    expect(await factory.feeTo()).to.equal(wallet.address)
    expect(await factory.allPairsLength()).to.equal(0)
  })

  it('version', async () => {
    expect(await factory.versionRecipient()).to.equal('1')
  })

  async function createPair(tokens) {
    await expect(factory.createPair(...tokens)).to.emit(factory, 'PairCreated')
    let pairAddress = await factory.getPair(...tokens)

    await expect(factory.createPair(...tokens)).to.be.reverted // Unifarm: PAIR_EXISTS
    await expect(factory.createPair(...tokens.slice().reverse())).to.be.reverted // Unifarm: PAIR_EXISTS
    expect(await factory.getPair(...tokens)).to.eq(pairAddress)
    expect(await factory.getPair(...tokens.slice().reverse())).to.eq(pairAddress)
    expect(await factory.allPairs(0)).to.eq(pairAddress)
    expect(await factory.allPairsLength()).to.eq(1)

    const UnifarmPairContract = await ethers.getContractFactory('UnifarmPair')
    const pair = await UnifarmPairContract.attach(pairAddress)

    expect(await pair.factory()).to.eq(factory.address)
    expect(await pair.token0()).to.eq(TEST_ADDRESSES[0])
    expect(await pair.token1()).to.eq(TEST_ADDRESSES[1])
  }

  it('createPair', async () => {
    await createPair(TEST_ADDRESSES)
  })

  it('createPair:reverse', async () => {
    await createPair(TEST_ADDRESSES.slice().reverse())
  })

  it('createPair:gas', async () => {
    const tx = await factory.createPair(...TEST_ADDRESSES)
    const receipt = await tx.wait()
    expect(receipt.gasUsed).to.gte(2821242)
  })

  it('setFeeTo', async () => {
    await expect(factory.connect(other).setFeeTo(other.address)).to.be.revertedWith('Ownable: caller is not the owner')
    await factory.setFeeTo(wallet.address)
    expect(await factory.feeTo()).to.eq(wallet.address)
  })

  it('updateLPFeeConfig', async () => {
    await expect(
      factory.connect(other).updateLPFeeConfig(TEST_ADDRESSES[0], TEST_ADDRESSES[1], lpFeesInToken, lpFee)
    ).to.be.revertedWith('Ownable: caller is not the owner')
    await createPair(TEST_ADDRESSES)

    await factory.updateLPFeeConfig(TEST_ADDRESSES[0], TEST_ADDRESSES[1], lpFeesInToken, lpFee)
    expect(await factory.feeTo()).to.eq(wallet.address)

    await factory.updateLPFeeConfig(TEST_ADDRESSES[0], TEST_ADDRESSES[1], false, lpFee)
    expect(await factory.feeTo()).to.eq(wallet.address)
  })

  it('updateSwapFeeConfig', async () => {
    await expect(
      factory.connect(other).updateSwapFeeConfig(TEST_ADDRESSES[0], TEST_ADDRESSES[1], lpFeesInToken, lpFee)
    ).to.be.revertedWith('Ownable: caller is not the owner')
    await createPair(TEST_ADDRESSES)
    await factory.updateSwapFeeConfig(TEST_ADDRESSES[0], TEST_ADDRESSES[1], lpFeesInToken, lpFee)
    expect(await factory.feeTo()).to.eq(wallet.address)
  })
})
