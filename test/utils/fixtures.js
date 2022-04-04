const { waffle, ethers } = require('hardhat')
const { deployContract } = waffle

const { Contract } = ethers
const { expandTo18Decimals } = require('./utilities')

const ERC20 = require('../../artifacts/contracts/test/ERC20.sol/ERC20.json')
const UnifarmFactory = require('../../artifacts/contracts/UnifarmFactory.sol/UnifarmFactory.json')
const UnifarmPair = require('../../artifacts/contracts/UnifarmPair.sol/UnifarmPair.json')
const UnifarmRouter = require('../../artifacts/contracts/utility/UnifarmRouter02.sol/UnifarmRouter02.json')
const WETH = require('../../artifacts/contracts/test/WETH9.sol/WETH9.json')

const overrides = {
  gasLimit: 9999999
}

async function factoryFixture(wallet) {
  const factory = await deployContract(wallet, UnifarmFactory, [wallet.address], overrides)
  return { factory }
}

async function pairFixture([wallet]) {
  const { factory } = await factoryFixture([wallet])

  const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)], overrides)
  const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)], overrides)

  await factory.createPair(tokenA.address, tokenB.address, overrides)
  const pairAddress = await factory.getPair(tokenA.address, tokenB.address)
  const pair = new Contract(pairAddress, JSON.stringify(UnifarmPair.abi), provider).connect(wallet)

  const router02 = await deployContract(wallet, UnifarmRouter, [factory.address, WETH.address], overrides)

  const token0Address = (await pair.token0()).address
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  return { factory, token0, token1, router: router02, pair }
}

module.exports = {
  factoryFixture,
  pairFixture
}
