const { use, expect } = require('chai')
const { ethers, waffle } = require('hardhat')
const { BigNumber } = require('@ethersproject/bignumber')

const { expandTo18Decimals, MINIMUM_LIQUIDITY } = require('../test/utils/utilities')
const { solidity } = waffle

use(solidity)
const { MaxUint256, AddressZero } = ethers.constants

describe('UnifarmRouter02 - liquidity', () => {
  let wallet, other, trustedForwarder
  let factory
  let lpFee = 2
  let swapFee = 2
  let lpFeesInToken = true
  let swapFeesInToken = true

  let token0
  let token1
  let router

  let WETH
  let WETHPartner
  let pair
  let WETHPair

  const TOTAL_SUPPLY = expandTo18Decimals(1000000000)

  beforeEach(async () => {
    ;[wallet, other, trustedForwarder] = await ethers.getSigners()

    const Factory = await ethers.getContractFactory('UnifarmFactory')
    const UnifarmPairContract = await ethers.getContractFactory('UnifarmPair')
    const Token = await ethers.getContractFactory('ERC20')
    const Router = await ethers.getContractFactory('UnifarmRouter02')
    const WETH9 = await ethers.getContractFactory('WETH9')

    const tokenA = await Token.deploy(TOTAL_SUPPLY)
    const tokenB = await Token.deploy(TOTAL_SUPPLY)
    WETH = await WETH9.deploy()
    WETHPartner = await WETH9.deploy()

    await WETHPartner.deposit({ value: expandTo18Decimals(10000) })
    await tokenA.transfer(other.address, expandTo18Decimals('5000'))
    await tokenB.transfer(other.address, expandTo18Decimals('5000'))

    factory = await Factory.deploy(
      wallet.address,
      trustedForwarder.address,
      lpFee,
      swapFee,
      lpFeesInToken,
      swapFeesInToken
    )
    router = await Router.deploy(factory.address, WETH.address)

    await factory.createPair(tokenA.address, tokenB.address)
    let pairAddress = await factory.getPair(tokenA.address, tokenB.address)
    pair = await UnifarmPairContract.attach(pairAddress)

    const token0Address = await pair.token0()
    token0 = tokenA.address === token0Address ? tokenA : tokenB
    token1 = tokenA.address === token0Address ? tokenB : tokenA

    await factory.createPair(WETH.address, WETHPartner.address)
    WETHPairAddress = await factory.getPair(WETH.address, WETHPartner.address)
    WETHPair = await UnifarmPairContract.attach(WETHPairAddress)
  })

  afterEach(async function() {
    expect(await ethers.provider.getBalance(router.address)).to.eq('0')
  })

  it('factory, WETH', async () => {
    expect(await router.factory()).to.eq(factory.address)
    expect(await router.WETH()).to.eq(WETH.address)
  })

  it('addLiquidity', async () => {
    const token0Amount = expandTo18Decimals(1)
    const token1Amount = expandTo18Decimals(4)

    const expectedLiquidity = expandTo18Decimals(2)
    await token0.approve(router.address, MaxUint256)
    await token1.approve(router.address, MaxUint256)
    await expect(
      router.addLiquidity(token0.address, token1.address, token0Amount, token1Amount, 0, 0, wallet.address, MaxUint256)
    )
      .to.emit(token0, 'Transfer')
      .withArgs(wallet.address, pair.address, token0Amount)
      .to.emit(token1, 'Transfer')
      .withArgs(wallet.address, pair.address, token1Amount)
      .to.emit(pair, 'Transfer')
      .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
      .to.emit(pair, 'Transfer')
      .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(pair, 'Sync')
      .withArgs(token0Amount, token1Amount)
      .to.emit(pair, 'Mint')
      .withArgs(router.address, token0Amount, token1Amount)

    expect(await pair.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
  })

  it('addLiquidityETH', async () => {
    const WETHPartnerAmount = expandTo18Decimals(1)
    const ETHAmount = expandTo18Decimals(4)

    const expectedLiquidity = expandTo18Decimals(2)
    const WETHPairToken0 = await WETHPair.token0()
    await WETHPartner.approve(router.address, MaxUint256)
    await expect(
      router.addLiquidityETH(
        WETHPartner.address,
        WETHPartnerAmount,
        WETHPartnerAmount,
        ETHAmount,
        wallet.address,
        MaxUint256,
        { value: ETHAmount }
      )
    )
      .to.emit(WETHPair, 'Transfer')
      .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
      .to.emit(WETHPair, 'Transfer')
      .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(WETHPair, 'Sync')
      .withArgs(
        WETHPairToken0 === WETHPartner.address ? WETHPartnerAmount : ETHAmount,
        WETHPairToken0 === WETHPartner.address ? ETHAmount : WETHPartnerAmount
      )
      .to.emit(WETHPair, 'Mint')
      .withArgs(
        router.address,
        WETHPairToken0 === WETHPartner.address ? WETHPartnerAmount : ETHAmount,
        WETHPairToken0 === WETHPartner.address ? ETHAmount : WETHPartnerAmount
      )

    expect(await WETHPair.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
  })

  async function addLiquidity(token0Amount, token1Amount) {
    await token0.transfer(pair.address, token0Amount)
    await token1.transfer(pair.address, token1Amount)
    await pair.mint(wallet.address)
  }

  it('removeLiquidity', async () => {
    const token0Amount = expandTo18Decimals(1)
    const token1Amount = expandTo18Decimals(4)
    await addLiquidity(token0Amount, token1Amount)

    const expectedLiquidity = expandTo18Decimals(2)
    await pair.approve(router.address, MaxUint256)
    await expect(
      router.removeLiquidity(
        token0.address,
        token1.address,
        expectedLiquidity.sub(MINIMUM_LIQUIDITY),
        0,
        0,
        wallet.address,
        MaxUint256
      )
    )
      .to.emit(pair, 'Transfer')
      .withArgs(wallet.address, pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(pair, 'Transfer')
      .withArgs(pair.address, AddressZero, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(token0, 'Transfer')
      .withArgs(pair.address, wallet.address, token0Amount.sub(500))
      .to.emit(token1, 'Transfer')
      .withArgs(pair.address, wallet.address, token1Amount.sub(2000))
      .to.emit(pair, 'Sync')
      .withArgs(500, 2000)
      .to.emit(pair, 'Burn')
      .withArgs(router.address, token0Amount.sub(500), token1Amount.sub(2000), wallet.address, 0)

    expect(await pair.balanceOf(wallet.address)).to.eq(0)
  })

  it('removeLiquidityETH', async () => {
    const WETHPartnerAmount = expandTo18Decimals(1)
    const ETHAmount = expandTo18Decimals(4)
    await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
    await WETH.deposit({ value: ETHAmount })
    await WETH.transfer(WETHPair.address, ETHAmount)
    await WETHPair.mint(wallet.address)

    const expectedLiquidity = expandTo18Decimals(2)
    const WETHPairToken0 = await WETHPair.token0()
    await WETHPair.approve(router.address, MaxUint256)
    await expect(
      router.removeLiquidityETH(
        WETHPartner.address,
        expectedLiquidity.sub(MINIMUM_LIQUIDITY),
        0,
        0,
        wallet.address,
        MaxUint256
      )
    )
      .to.emit(WETHPair, 'Transfer')
      .withArgs(wallet.address, WETHPair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(WETHPair, 'Transfer')
      .withArgs(WETHPair.address, AddressZero, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(WETH, 'Transfer')
      .withArgs(WETHPair.address, router.address, ETHAmount.sub(2000))
      .to.emit(WETHPartner, 'Transfer')
      .withArgs(WETHPair.address, router.address, WETHPartnerAmount.sub(500))
      .to.emit(WETHPartner, 'Transfer')
      .withArgs(router.address, wallet.address, WETHPartnerAmount.sub(500))
      .to.emit(WETHPair, 'Sync')
      .withArgs(
        WETHPairToken0 === WETHPartner.address ? 500 : 2000,
        WETHPairToken0 === WETHPartner.address ? 2000 : 500
      )
      .to.emit(WETHPair, 'Burn')
      .withArgs(
        router.address,
        WETHPairToken0 === WETHPartner.address ? WETHPartnerAmount.sub(500) : ETHAmount.sub(2000),
        WETHPairToken0 === WETHPartner.address ? ETHAmount.sub(2000) : WETHPartnerAmount.sub(500),
        router.address,
        0
      )

    expect(await WETHPair.balanceOf(wallet.address)).to.eq(0)
    const totalSupplyWETHPartner = await WETHPartner.totalSupply()
    const totalSupplyWETH = await WETH.totalSupply()
    expect(await WETHPartner.balanceOf(wallet.address)).to.eq(totalSupplyWETHPartner.sub(500))
    expect(await WETH.balanceOf(wallet.address)).to.eq(totalSupplyWETH.sub(2000))
  })

  // it('removeLiquidityWithPermit', async () => {
  //   const token0Amount = expandTo18Decimals(1)
  //   const token1Amount = expandTo18Decimals(4)
  //   await addLiquidity(token0Amount, token1Amount)

  //   const expectedLiquidity = expandTo18Decimals(2)

  //   const nonce = await pair.nonces(wallet.address)
  //   const digest = await getApprovalDigest(
  //     pair,
  //     { owner: wallet.address, spender: router.address, value: expectedLiquidity.sub(MINIMUM_LIQUIDITY) },
  //     nonce,
  //     MaxUint256
  //   )

  //   const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

  //   await router.removeLiquidityWithPermit(
  //     token0.address,
  //     token1.address,
  //     expectedLiquidity.sub(MINIMUM_LIQUIDITY),
  //     0,
  //     0,
  //     wallet.address,
  //     MaxUint256,
  //     false,
  //     v,
  //     r,
  //     s
  //   )
  // })

  // it('removeLiquidityETHWithPermit', async () => {
  //   const WETHPartnerAmount = expandTo18Decimals(1)
  //   const ETHAmount = expandTo18Decimals(4)
  //   await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
  //   await WETH.deposit({ value: ETHAmount })
  //   await WETH.transfer(WETHPair.address, ETHAmount)
  //   await WETHPair.mint(wallet.address)

  //   const expectedLiquidity = expandTo18Decimals(2)

  //   const nonce = await WETHPair.nonces(wallet.address)
  //   const digest = await getApprovalDigest(
  //     WETHPair,
  //     { owner: wallet.address, spender: router.address, value: expectedLiquidity.sub(MINIMUM_LIQUIDITY) },
  //     nonce,
  //     MaxUint256
  //   )

  //   const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

  //   await router.removeLiquidityETHWithPermit(
  //     WETHPartner.address,
  //     expectedLiquidity.sub(MINIMUM_LIQUIDITY),
  //     0,
  //     0,
  //     wallet.address,
  //     MaxUint256,
  //     false,
  //     v,
  //     r,
  //     s
  //   )
  // })

  describe('swapExactTokensForTokens', () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigNumber.from('1663887962654218072')

    beforeEach(async () => {
      await addLiquidity(token0Amount, token1Amount)
      await token0.approve(router.address, MaxUint256)
    })

    it('happy path', async () => {
      await expect(
        router.swapExactTokensForTokens(swapAmount, 0, [token0.address, token1.address], wallet.address, MaxUint256, 0)
      )
        .to.emit(token0, 'Transfer')
        .withArgs(wallet.address, pair.address, swapAmount)
        .to.emit(token1, 'Transfer')
        .withArgs(pair.address, wallet.address, expectedOutputAmount)
        .to.emit(pair, 'Swap')
        .withArgs(router.address, swapAmount, 0, 0, expectedOutputAmount, wallet.address)
    })

    it('gas', async () => {
      // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
      await ethers.provider.send('evm_mine')
      await pair.sync()

      await token0.approve(router.address, MaxUint256)
      await ethers.provider.send('evm_mine')

      const tx = await router.swapExactTokensForTokens(
        swapAmount,
        0,
        [token0.address, token1.address],
        wallet.address,
        MaxUint256,
        0
      )
      const receipt = await tx.wait()
      expect(receipt.gasUsed).to.gte(101898)
    }).retries(3)
  })

  describe('swapTokensForExactTokens', () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    const expectedSwapAmount = BigNumber.from('556668893342240036')
    const outputAmount = expandTo18Decimals(1)

    beforeEach(async () => {
      await addLiquidity(token0Amount, token1Amount)
    })

    it('happy path', async () => {
      await token0.approve(router.address, MaxUint256)
      await expect(
        router.swapTokensForExactTokens(
          outputAmount,
          MaxUint256,
          [token0.address, token1.address],
          wallet.address,
          MaxUint256,
          0
        )
      )
        .to.emit(token0, 'Transfer')
        .withArgs(wallet.address, pair.address, expectedSwapAmount)
        .to.emit(token1, 'Transfer')
        .withArgs(pair.address, wallet.address, outputAmount)
        .to.emit(pair, 'Swap')
        .withArgs(router.address, expectedSwapAmount, 0, 0, outputAmount, wallet.address)
    })
  })

  describe('swapExactETHForTokens', () => {
    const WETHPartnerAmount = expandTo18Decimals(10)
    const ETHAmount = expandTo18Decimals(5)
    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigNumber.from('1663887962654218072')

    beforeEach(async () => {
      await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
      await WETH.deposit({ value: ETHAmount })
      await WETH.transfer(WETHPair.address, ETHAmount)
      await WETHPair.mint(wallet.address)

      await token0.approve(router.address, MaxUint256)
    })

    it('happy path', async () => {
      const WETHPairToken0 = await WETHPair.token0()
      await expect(
        router.swapExactETHForTokens(0, [WETH.address, WETHPartner.address], wallet.address, MaxUint256, 0, {
          value: swapAmount
        })
      )
        .to.emit(WETH, 'Transfer')
        .withArgs(router.address, WETHPair.address, swapAmount)
        .to.emit(WETHPartner, 'Transfer')
        .withArgs(WETHPair.address, wallet.address, expectedOutputAmount)
        .to.emit(WETHPair, 'Swap')
        .withArgs(
          router.address,
          WETHPairToken0 === WETHPartner.address ? 0 : swapAmount,
          WETHPairToken0 === WETHPartner.address ? swapAmount : 0,
          WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
          WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
          wallet.address
        )
    })

    it('gas', async () => {
      const WETHPartnerAmount = expandTo18Decimals(10)
      const ETHAmount = expandTo18Decimals(5)
      await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
      await WETH.deposit({ value: ETHAmount })
      await WETH.transfer(WETHPair.address, ETHAmount)
      await WETHPair.mint(wallet.address)

      // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
      await ethers.provider.send('evm_mine')

      await pair.sync()

      const swapAmount = expandTo18Decimals(1)
      await ethers.provider.send('evm_mine')

      const tx = await router.swapExactETHForTokens(
        0,
        [WETH.address, WETHPartner.address],
        wallet.address,
        MaxUint256,
        0,
        {
          value: swapAmount
        }
      )
      const receipt = await tx.wait()
      expect(receipt.gasUsed).to.gte(138770)
    }).retries(3)
  })

  describe('swapTokensForExactETH', () => {
    const WETHPartnerAmount = expandTo18Decimals(5)
    const ETHAmount = expandTo18Decimals(10)
    const expectedSwapAmount = BigNumber.from('556668893342240036')
    const outputAmount = expandTo18Decimals(1)

    beforeEach(async () => {
      await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
      await WETH.deposit({ value: ETHAmount })
      await WETH.transfer(WETHPair.address, ETHAmount)
      await WETHPair.mint(wallet.address)
    })

    it('happy path', async () => {
      await WETHPartner.approve(router.address, MaxUint256)
      const WETHPairToken0 = await WETHPair.token0()
      await expect(
        router.swapTokensForExactETH(
          outputAmount,
          MaxUint256,
          [WETHPartner.address, WETH.address],
          wallet.address,
          MaxUint256,
          0
        )
      )
        .to.emit(WETHPartner, 'Transfer')
        .withArgs(wallet.address, WETHPair.address, expectedSwapAmount)
        .to.emit(WETH, 'Transfer')
        .withArgs(WETHPair.address, router.address, outputAmount)
        .to.emit(WETHPair, 'Swap')
        .withArgs(
          router.address,
          WETHPairToken0 === WETHPartner.address ? expectedSwapAmount : 0,
          WETHPairToken0 === WETHPartner.address ? 0 : expectedSwapAmount,
          WETHPairToken0 === WETHPartner.address ? 0 : outputAmount,
          WETHPairToken0 === WETHPartner.address ? outputAmount : 0,
          router.address
        )
    })
  })

  describe('swapExactTokensForETH', () => {
    const WETHPartnerAmount = expandTo18Decimals(5)
    const ETHAmount = expandTo18Decimals(10)
    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigNumber.from('1663887962654218072')

    beforeEach(async () => {
      await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
      await WETH.deposit({ value: ETHAmount })
      await WETH.transfer(WETHPair.address, ETHAmount)
      await WETHPair.mint(wallet.address)
    })

    it('happy path', async () => {
      await WETHPartner.approve(router.address, MaxUint256)
      const WETHPairToken0 = await WETHPair.token0()
      await expect(
        router.swapExactTokensForETH(swapAmount, 0, [WETHPartner.address, WETH.address], wallet.address, MaxUint256, 0)
      )
        .to.emit(WETHPartner, 'Transfer')
        .withArgs(wallet.address, WETHPair.address, swapAmount)
        .to.emit(WETH, 'Transfer')
        .withArgs(WETHPair.address, router.address, expectedOutputAmount)
        .to.emit(WETHPair, 'Swap')
        .withArgs(
          router.address,
          WETHPairToken0 === WETHPartner.address ? swapAmount : 0,
          WETHPairToken0 === WETHPartner.address ? 0 : swapAmount,
          WETHPairToken0 === WETHPartner.address ? 0 : expectedOutputAmount,
          WETHPairToken0 === WETHPartner.address ? expectedOutputAmount : 0,
          router.address
        )
    })
  })

  describe('swapETHForExactTokens', () => {
    const WETHPartnerAmount = expandTo18Decimals(10)
    const ETHAmount = expandTo18Decimals(5)
    const expectedSwapAmount = BigNumber.from('556668893342240036')
    const outputAmount = expandTo18Decimals(1)

    beforeEach(async () => {
      await WETHPartner.transfer(WETHPair.address, WETHPartnerAmount)
      await WETH.deposit({ value: ETHAmount })
      await WETH.transfer(WETHPair.address, ETHAmount)
      await WETHPair.mint(wallet.address)
    })

    it('happy path', async () => {
      const WETHPairToken0 = await WETHPair.token0()
      await expect(
        router.swapETHForExactTokens(outputAmount, [WETH.address, WETHPartner.address], wallet.address, MaxUint256, 0, {
          value: expectedSwapAmount
        })
      )
        .to.emit(WETH, 'Transfer')
        .withArgs(router.address, WETHPair.address, expectedSwapAmount)
        .to.emit(WETHPartner, 'Transfer')
        .withArgs(WETHPair.address, wallet.address, outputAmount)
        .to.emit(WETHPair, 'Swap')
        .withArgs(
          router.address,
          WETHPairToken0 === WETHPartner.address ? 0 : expectedSwapAmount,
          WETHPairToken0 === WETHPartner.address ? expectedSwapAmount : 0,
          WETHPairToken0 === WETHPartner.address ? outputAmount : 0,
          WETHPairToken0 === WETHPartner.address ? 0 : outputAmount,
          wallet.address
        )
    })
  })
})

describe('UnifarmRouter02', async () => {
  let wallet, other, trustedForwarder
  let factory
  let lpFee = 2
  let swapFee = 2
  let lpFeesInToken = true
  let swapFeesInToken = true

  let token0
  let token1
  let router

  const TOTAL_SUPPLY = expandTo18Decimals(1000000000)

  beforeEach(async () => {
    ;[wallet, other, trustedForwarder] = await ethers.getSigners()

    const Factory = await ethers.getContractFactory('UnifarmFactory')
    const UnifarmPairContract = await ethers.getContractFactory('UnifarmPair')
    const Token = await ethers.getContractFactory('ERC20')
    const Router = await ethers.getContractFactory('UnifarmRouter02')
    const WETH = await ethers.getContractFactory('WETH9')

    const tokenA = await Token.deploy(TOTAL_SUPPLY)
    const tokenB = await Token.deploy(TOTAL_SUPPLY)
    const weth = await WETH.deploy()

    await tokenA.transfer(other.address, expandTo18Decimals('5000'))
    await tokenB.transfer(other.address, expandTo18Decimals('5000'))

    factory = await Factory.deploy(
      wallet.address,
      trustedForwarder.address,
      lpFee,
      swapFee,
      lpFeesInToken,
      swapFeesInToken
    )
    router = await Router.deploy(factory.address, weth.address)

    await factory.createPair(tokenA.address, tokenB.address)
    let pairAddress = await factory.getPair(tokenA.address, tokenB.address)
    pair = await UnifarmPairContract.attach(pairAddress)

    const token0Address = await pair.token0()
    token0 = tokenA.address === token0Address ? tokenA : tokenB
    token1 = tokenA.address === token0Address ? tokenB : tokenA
  })

  it('quote', async () => {
    expect(await router.quote(BigNumber.from(1), BigNumber.from(100), BigNumber.from(200))).to.eq(BigNumber.from(2))
    expect(await router.quote(BigNumber.from(2), BigNumber.from(200), BigNumber.from(100))).to.eq(BigNumber.from(1))
    await expect(router.quote(BigNumber.from(0), BigNumber.from(100), BigNumber.from(200))).to.be.revertedWith(
      'UnifarmLibrary: INSUFFICIENT_AMOUNT'
    )
    await expect(router.quote(BigNumber.from(1), BigNumber.from(0), BigNumber.from(200))).to.be.revertedWith(
      'UnifarmLibrary: INSUFFICIENT_LIQUIDITY'
    )
    await expect(router.quote(BigNumber.from(1), BigNumber.from(100), BigNumber.from(0))).to.be.revertedWith(
      'UnifarmLibrary: INSUFFICIENT_LIQUIDITY'
    )
  })

  it('getAmountOut', async () => {
    expect(
      await router.getAmountOut(
        BigNumber.from(2),
        BigNumber.from(100),
        BigNumber.from(100),
        token0.address,
        token1.address
      )
    ).to.eq(BigNumber.from(1))
    await expect(
      router.getAmountOut(BigNumber.from(0), BigNumber.from(100), BigNumber.from(100), token0.address, token1.address)
    ).to.be.revertedWith('UnifarmLibrary: INSUFFICIENT_INPUT_AMOUNT')
    await expect(
      router.getAmountOut(BigNumber.from(2), BigNumber.from(0), BigNumber.from(100), token0.address, token1.address)
    ).to.be.revertedWith('UnifarmLibrary: INSUFFICIENT_LIQUIDITY')
    await expect(
      router.getAmountOut(BigNumber.from(2), BigNumber.from(100), BigNumber.from(0), token0.address, token1.address)
    ).to.be.revertedWith('UnifarmLibrary: INSUFFICIENT_LIQUIDITY')
  })

  it('getAmountIn', async () => {
    expect(
      await router.getAmountIn(
        BigNumber.from(1),
        BigNumber.from(100),
        BigNumber.from(100),
        token0.address,
        token1.address
      )
    ).to.eq(BigNumber.from(2))
    await expect(
      router.getAmountIn(BigNumber.from(0), BigNumber.from(100), BigNumber.from(100), token0.address, token1.address)
    ).to.be.revertedWith('UnifarmLibrary: INSUFFICIENT_OUTPUT_AMOUNT')
    await expect(
      router.getAmountIn(BigNumber.from(1), BigNumber.from(0), BigNumber.from(100), token0.address, token1.address)
    ).to.be.revertedWith('UnifarmLibrary: INSUFFICIENT_LIQUIDITY')
    await expect(
      router.getAmountIn(BigNumber.from(1), BigNumber.from(100), BigNumber.from(0), token0.address, token1.address)
    ).to.be.revertedWith('UnifarmLibrary: INSUFFICIENT_LIQUIDITY')
  })

  it('getAmountsOut', async () => {
    await token0.approve(router.address, MaxUint256)
    await token1.approve(router.address, MaxUint256)
    await router.addLiquidity(
      token0.address,
      token1.address,
      BigNumber.from(10000),
      BigNumber.from(10000),
      0,
      0,
      wallet.address,
      MaxUint256
    )

    await expect(router.getAmountsOut(BigNumber.from(2), [token0.address])).to.be.revertedWith(
      'UnifarmLibrary: INVALID_PATH'
    )
    const path = [token0.address, token1.address]
    expect(await router.getAmountsOut(BigNumber.from(2), path)).to.deep.eq([BigNumber.from(2), BigNumber.from(1)])
  })

  it('getAmountsIn', async () => {
    await token0.approve(router.address, MaxUint256)
    await token1.approve(router.address, MaxUint256)
    await router.addLiquidity(
      token0.address,
      token1.address,
      BigNumber.from(10000),
      BigNumber.from(10000),
      0,
      0,
      wallet.address,
      MaxUint256
    )

    await expect(router.getAmountsIn(BigNumber.from(1), [token0.address])).to.be.revertedWith(
      'UnifarmLibrary: INVALID_PATH'
    )
    const path = [token0.address, token1.address]
    expect(await router.getAmountsIn(BigNumber.from(1), path)).to.deep.eq([BigNumber.from(2), BigNumber.from(1)])
  })
})

describe('fee-on-transfer tokens', async () => {
  let wallet, other, trustedForwarder
  let factory
  let lpFee = 2
  let swapFee = 2
  let lpFeesInToken = true
  let swapFeesInToken = true

  let DTT
  let WETH
  let router
  let pair

  const TOTAL_SUPPLY = expandTo18Decimals(1000000000)

  beforeEach(async function() {
    ;[wallet, other, trustedForwarder] = await ethers.getSigners()

    const Factory = await ethers.getContractFactory('UnifarmFactory')
    const UnifarmPairContract = await ethers.getContractFactory('UnifarmPair')
    const Token = await ethers.getContractFactory('ERC20')
    const Router = await ethers.getContractFactory('UnifarmRouter02')
    const WETH9 = await ethers.getContractFactory('WETH9')

    DTT = await Token.deploy(TOTAL_SUPPLY)
    WETH = await WETH9.deploy()

    await WETH.deposit({ value: expandTo18Decimals('500') })

    await DTT.transfer(other.address, expandTo18Decimals('5000'))
    await WETH.transfer(other.address, expandTo18Decimals('500'))

    factory = await Factory.deploy(
      wallet.address,
      trustedForwarder.address,
      lpFee,
      swapFee,
      lpFeesInToken,
      swapFeesInToken
    )
    router = await Router.deploy(factory.address, WETH.address)

    // make a DTT<>WETH pair
    await factory.createPair(DTT.address, WETH.address)
    let pairAddress = await factory.getPair(DTT.address, WETH.address)
    pair = await UnifarmPairContract.attach(pairAddress)

    const token0Address = await pair.token0()
    token0 = DTT.address === token0Address ? DTT : WETH
    token1 = DTT.address === token0Address ? WETH : DTT
  })

  afterEach(async function() {
    expect(await ethers.provider.getBalance(router.address)).to.eq(0)
  })

  async function addLiquidity(DTTAmount, WETHAmount) {
    await DTT.approve(router.address, MaxUint256)
    await router.addLiquidityETH(DTT.address, DTTAmount, DTTAmount, WETHAmount, wallet.address, MaxUint256, {
      value: BigNumber.from(WETHAmount)
    })
  }

  it('removeLiquidityETHSupportingFeeOnTransferTokens', async () => {
    const DTTAmount = expandTo18Decimals(1)
    const ETHAmount = expandTo18Decimals(4)
    await addLiquidity(DTTAmount, ETHAmount)

    const DTTInPair = await DTT.balanceOf(pair.address)
    const WETHInPair = await WETH.balanceOf(pair.address)
    const liquidity = await pair.balanceOf(wallet.address)
    const totalSupply = await pair.totalSupply()
    const NaiveDTTExpected = DTTInPair.mul(liquidity).div(totalSupply)
    const WETHExpected = WETHInPair.mul(liquidity).div(totalSupply)

    await pair.approve(router.address, MaxUint256)
    await router.removeLiquidityETHSupportingFeeOnTransferTokens(
      DTT.address,
      liquidity,
      NaiveDTTExpected,
      WETHExpected,
      wallet.address,
      MaxUint256
    )
  })

  describe('swapExactTokensForTokensSupportingFeeOnTransferTokens', () => {
    const DTTAmount = expandTo18Decimals(5)
      .mul(100)
      .div(99)
    const ETHAmount = expandTo18Decimals(10)
    const amountIn = expandTo18Decimals(1)

    beforeEach(async () => {
      await addLiquidity(DTTAmount, ETHAmount)
    })

    it('DTT -> WETH', async () => {
      await DTT.approve(router.address, MaxUint256)

      await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,
        0,
        [DTT.address, WETH.address],
        wallet.address,
        MaxUint256,
        0
      )
    })

    // WETH -> DTT
    it('WETH -> DTT', async () => {
      await WETH.deposit({ value: amountIn }) // mint WETH
      await WETH.approve(router.address, MaxUint256)

      await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,
        0,
        [WETH.address, DTT.address],
        wallet.address,
        MaxUint256,
        0
      )
    })
  })

  // ETH -> DTT
  it('swapExactETHForTokensSupportingFeeOnTransferTokens', async () => {
    const DTTAmount = expandTo18Decimals(10)
      .mul(100)
      .div(99)
    const ETHAmount = expandTo18Decimals(5)
    const swapAmount = expandTo18Decimals(1)
    await addLiquidity(DTTAmount, ETHAmount)

    await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
      0,
      [WETH.address, DTT.address],
      wallet.address,
      MaxUint256,
      0,
      {
        value: swapAmount
      }
    )
  })

  // DTT -> ETH
  it('swapExactTokensForETHSupportingFeeOnTransferTokens', async () => {
    const DTTAmount = expandTo18Decimals(5)
      .mul(100)
      .div(99)
    const ETHAmount = expandTo18Decimals(10)
    const swapAmount = expandTo18Decimals(1)

    await addLiquidity(DTTAmount, ETHAmount)
    await DTT.approve(router.address, MaxUint256)

    await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
      swapAmount,
      0,
      [DTT.address, WETH.address],
      wallet.address,
      MaxUint256,
      0
    )
  })
})

describe('fee-on-transfer tokens: reloaded', async () => {
  let wallet, trustedForwarder
  let factory
  let lpFee = 2
  let swapFee = 2
  let lpFeesInToken = true
  let swapFeesInToken = true

  let DTT
  let DTT2
  let router

  const TOTAL_SUPPLY = expandTo18Decimals(1000000000)

  beforeEach(async () => {
    ;[wallet, trustedForwarder] = await ethers.getSigners()

    const Factory = await ethers.getContractFactory('UnifarmFactory')
    const UnifarmPairContract = await ethers.getContractFactory('UnifarmPair')
    const Token = await ethers.getContractFactory('ERC20')
    const Router = await ethers.getContractFactory('UnifarmRouter02')
    const WETH = await ethers.getContractFactory('WETH9')

    const tokenA = await Token.deploy(TOTAL_SUPPLY)
    const tokenB = await Token.deploy(TOTAL_SUPPLY)
    const weth = await WETH.deploy()

    factory = await Factory.deploy(
      wallet.address,
      trustedForwarder.address,
      lpFee,
      swapFee,
      lpFeesInToken,
      swapFeesInToken
    )
    router = await Router.deploy(factory.address, weth.address)

    await factory.createPair(tokenA.address, tokenB.address)
    let pairAddress = await factory.getPair(tokenA.address, tokenB.address)
    pair = UnifarmPairContract.attach(pairAddress)

    const token0Address = await pair.token0()
    DTT = tokenA.address === token0Address ? tokenA : tokenB
    DTT2 = tokenA.address === token0Address ? tokenB : tokenA
  })

  afterEach(async function() {
    expect(await ethers.provider.getBalance(router.address)).to.eq(0)
  })

  async function addLiquidity(DTTAmount, DTT2Amount) {
    await DTT.approve(router.address, MaxUint256)
    await DTT2.approve(router.address, MaxUint256)
    await router.addLiquidity(
      DTT.address,
      DTT2.address,
      DTTAmount,
      DTT2Amount,
      DTTAmount,
      DTT2Amount,
      wallet.address,
      MaxUint256
    )
  }

  describe('swapExactTokensForTokensSupportingFeeOnTransferTokens', () => {
    const DTTAmount = expandTo18Decimals(5)
      .mul(100)
      .div(99)
    const DTT2Amount = expandTo18Decimals(5)
    const amountIn = expandTo18Decimals(1)

    beforeEach(async () => {
      await addLiquidity(DTTAmount, DTT2Amount)
    })

    it('DTT -> DTT2', async () => {
      await DTT.approve(router.address, MaxUint256)

      await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountIn,
        0,
        [DTT.address, DTT2.address],
        wallet.address,
        MaxUint256,
        0
      )
    })
  })
})
