const { use, expect } = require('chai')
const { ethers, waffle } = require('hardhat')
const { solidity } = waffle
const { provider } = ethers
use(solidity)

const deployMultisig = async (owners, confirmations) => {
  const MultiSigWallet = await ethers.getContractFactory('MultiSigWallet')
  return MultiSigWallet.deploy(owners, confirmations)
}

describe('MultiSigWallet', () => {
  let multisigInstance
  const requiredConfirmations = 2

  async function balanceOf(provider, account) {
    return await provider.getBalance(account)
  }

  beforeEach(async () => {
    ;[accounts0, accounts1, accounts2, accounts3, accounts4] = await ethers.getSigners()
    multisigInstance = await deployMultisig(
      [accounts0.address, accounts1.address, accounts2.address],
      requiredConfirmations
    )
  })

  it('test execution after requirements changed', async () => {
    const deposit = 1000

    // Send money to wallet contract
    await accounts0.sendTransaction({
      to: multisigInstance.address,
      value: deposit
    })

    const balance = await balanceOf(provider, multisigInstance.address)
    expect(balance).to.eq(deposit)

    // Add owner
    const transactionId0 = 0 //add Owner
    const transactionId1 = 1 //change requirement
    const transactionId2 = 2 //after revocation

    let ABI = ['function addOwner(address to)']
    let iface = new ethers.utils.Interface(ABI)
    let addOwnerData = iface.encodeFunctionData('addOwner', [accounts3.address])

    await expect(multisigInstance.connect(accounts0).submitTransaction(multisigInstance.address, 0, addOwnerData))
      .to.emit(multisigInstance, 'Confirmation')
      .withArgs(accounts0.address,transactionId0)

    // There is one pending transaction
    const excludePending = false
    const includeExecuted = true
    const excludeExecuted = true
    const includePending = true

    // Update required to 1
    const newRequired = 1
    ABI = ['function changeRequirement(uint256 required)']
    iface = new ethers.utils.Interface(ABI)
    const updateRequirementData = iface.encodeFunctionData('changeRequirement', [newRequired])

    // Submit successfully
    await expect(
      multisigInstance.connect(accounts0).submitTransaction(multisigInstance.address, 0, updateRequirementData)
    )
      .to.emit(multisigInstance, 'Confirmation')
      .withArgs(accounts0.address, transactionId1)


    // Submit successfully
    await expect(
      multisigInstance.connect(accounts0).submitTransaction(multisigInstance.address, 0, updateRequirementData)
    )
      .to.emit(multisigInstance, 'Confirmation')
      .withArgs(accounts0.address, transactionId2)

    await expect(multisigInstance.connect(accounts0).revokeConfirmation(transactionId2))
      .to.emit(multisigInstance, 'Revocation')
      .withArgs(accounts0.address, transactionId2)

    // Confirm change requirement transaction
    await multisigInstance.connect(accounts1).confirmTransaction(transactionId1)
    expect(await multisigInstance.required()).to.equal(newRequired)
    expect((await multisigInstance.getTransactionIds(0, 1, excludePending, includeExecuted))[0]).to.equal(
      transactionId1
    )
    expect((await multisigInstance.getTransactionIds(0, 1, includePending, excludeExecuted))[0]).to.equal(
      transactionId0
    )

    // Execution fails, because sender is not wallet owner
    await expect(multisigInstance.connect(accounts4).executeTransaction(1)).to.be.revertedWith(
      'MultiSigWallet::ownerExists: ERR_ONWER_EXIST'
    )

    // Because the # required confirmations changed to 1, the addOwner transaction can be executed now
    await expect(multisigInstance.connect(accounts0).executeTransaction(transactionId0))
      .to.emit(multisigInstance, 'Execution')
      .withArgs(transactionId0)

    expect(await multisigInstance.connect(accounts1).getConfirmationCount(transactionId1)).to.equal(2)
    expect(await multisigInstance.connect(accounts1).getTransactionCount(false, true)).to.equal(2)
    expect(await multisigInstance.isConfirmed(1)).to.equal(true)
    expect(await multisigInstance.getOwners()).to.have.all.members([accounts0.address, accounts1.address, accounts2.address, accounts3.address])
    expect(await multisigInstance.connect(accounts1).getConfirmations(transactionId1)).to.have.all.members([accounts0.address, accounts1.address])
    
    ABI = ['function replaceOwner(address owner, address newOwner)']
    iface = new ethers.utils.Interface(ABI)
    const replaceOwnerData = iface.encodeFunctionData('replaceOwner', [accounts0.address, accounts4.address])
    await expect(multisigInstance.connect(accounts0).submitTransaction(multisigInstance.address, 0, replaceOwnerData))
      .to.emit(multisigInstance, 'OwnerRemoval')
      .withArgs(accounts0.address)
      .to.emit(multisigInstance, 'OwnerAddition')
      .withArgs(accounts4.address)

    ABI = ['function addOwner(address to)']
    iface = new ethers.utils.Interface(ABI)
    addOwnerData = iface.encodeFunctionData('addOwner', [accounts2.address])
    await expect(multisigInstance.connect(accounts2).submitTransaction(multisigInstance.address, 0, addOwnerData))
      .to.emit(multisigInstance, 'Confirmation')
      .withArgs(accounts2.address, 4)

    ABI = ['function removeOwner(address owner)']
    iface = new ethers.utils.Interface(ABI)
    const removeOwnerData = iface.encodeFunctionData('removeOwner', [accounts2.address])

    await expect(multisigInstance.connect(accounts2).submitTransaction(multisigInstance.address, 0, removeOwnerData))
      .to.emit(multisigInstance, 'OwnerRemoval')
      .withArgs(accounts2.address)

    expect(await multisigInstance.getTransactionCount(false, true)).to.equal(4)
  })
})
