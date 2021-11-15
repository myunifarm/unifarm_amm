const { use, expect } = require('chai')
const { ethers, waffle } = require('hardhat')
const { solidity } = waffle
use(solidity)
const { expandTo18Decimals } = require('./utils/utilities')

const deploy = async (feeTo, fee) => {
  const AMMUtility = await ethers.getContractFactory('AMMUtility')
  const Weth = await ethers.getContractFactory('WETH9')
  const weth = await Weth.deploy()
  return AMMUtility.deploy(feeTo, fee, weth.address)
}

describe('AMMUtility', () => {
  let ammUtilityInstance, sourceToken, destToken
  let owner, user
  let fee = expandTo18Decimals(2).div(100) //0.02 ETH

  beforeEach(async () => {
    ;[owner, user] = await ethers.getSigners()
    ammUtilityInstance = await deploy(owner.address, fee)

    const Token = await ethers.getContractFactory('ERC20')
    sourceToken = await Token.deploy(expandTo18Decimals('10000'))
    destToken = await Token.deploy(expandTo18Decimals('10000'))
  })

  it('swap', async () => {
    let zeroAddress = '0x0000000000000000000000000000000000000000'
    const amount = expandTo18Decimals(1)

    await expect(
      ammUtilityInstance
        .connect(user)
        .swapTokens(sourceToken.address, zeroAddress, user.address, ammUtilityInstance.address, '0x00', amount, fee, {
          value: fee
        })
    ).to.be.revertedWith('ZERO_TOKEN_ADDRESS')

    await expect(
      ammUtilityInstance
        .connect(user)
        .swapTokens(zeroAddress, destToken.address, user.address, ammUtilityInstance.address, '0x00', amount, fee, {
          value: fee
        })
    ).to.be.revertedWith('ZERO_TOKEN_ADDRESS')

    await expect(
      ammUtilityInstance
        .connect(user)
        .swapTokens(zeroAddress, zeroAddress, user.address, ammUtilityInstance.address, '0x00', amount, fee, {
          value: fee
        })
    ).to.be.revertedWith('ZERO_TOKEN_ADDRESS')

    await expect(
      ammUtilityInstance
        .connect(user)
        .swapTokens(
          sourceToken.address,
          sourceToken.address,
          user.address,
          ammUtilityInstance.address,
          '0x00',
          amount,
          fee,
          {
            value: fee
          }
        )
    ).to.be.revertedWith('SAME_ADDRESS')

    await expect(
      ammUtilityInstance
        .connect(user)
        .swapTokens(
          sourceToken.address,
          destToken.address,
          user.address,
          ammUtilityInstance.address,
          '0x00',
          amount,
          fee,
          {
            value: 0
          }
        )
    ).to.be.revertedWith('INVALID_FEE_PROVIDED')
  })

  it('withdrawToken', async () => {
    //transfer some tokens to user for swap
    await sourceToken.transfer(ammUtilityInstance.address, expandTo18Decimals(100))

    await expect(
      ammUtilityInstance.connect(user).withdrawToken(sourceToken.address, expandTo18Decimals(100))
    ).to.be.revertedWith('Ownable: caller is not the owner')

    await ammUtilityInstance.connect(owner).withdrawToken(sourceToken.address, expandTo18Decimals(100))
  })

  it('withdrawETH', async () => {
    await expect(
      owner.sendTransaction({
        to: ammUtilityInstance.address,
        value: ethers.utils.parseEther('1') // 1 ether
      })
    ).to.be.revertedWith('ERR_INVALID_ETH_SENDER')

    await expect(ammUtilityInstance.connect(user).withdrawETH()).to.be.revertedWith('Ownable: caller is not the owner')
  })

  /**
   * Tests are deprecated as 0x is integrated and used
   * Find the ropsten test script in script/0x-ropsten-test folder
   */
  // it('swap', async () => {
  //   let zeroAddress = '0x0000000000000000000000000000000000000000'
  //   const amount = expandTo18Decimals(1)

  //   //transfer some tokens to user for swap
  //   await sourceToken.transfer(user.address, expandTo18Decimals(100))

  //   //approve tokens to swap
  //   await sourceToken.connect(user).approve(ammUtilityInstance.address, amount)

  //   //transfer dest token to allow transfer to send after swap
  //   await destToken.transfer(ammUtilityInstance.address, expandTo18Decimals(10))

  //   await expect(
  //     ammUtilityInstance
  //       .connect(user)
  //       .swapTokens(user.address, sourceToken.address, destToken.address, amount, { value: fee })
  //   )
  //     .to.emit(ammUtilityInstance, 'TokenSwapExecuted')
  //     .withArgs(sourceToken.address, destToken.address, 1)
  // })
})
