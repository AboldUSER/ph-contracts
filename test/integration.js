const { expect } = require('chai')
const { ethers, upgrades } = require('hardhat')
const BN = ethers.BigNumber
const messageSigner = require('../lib/Signer.js')

describe('Papers Integration Tests', () => {
  let snapshotId
  let startBlock
  let deployer
  let userA
  let userB
  let userC
  let userD
  let signer
  let testStaking
  let buyPrice
  let presalePrice

  beforeEach(async () => {
    snapshotId = await ethers.provider.send('evm_snapshot')
  })

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [snapshotId])
  })

  before(async () => {
    ;[deployer, userA, userB, userC, userD, signer] = await ethers.getSigners()

    const TestERC721 = await ethers.getContractFactory('TestERC721')
    testERC721 = await upgrades.deployProxy(TestERC721, [signer.address])
    await testERC721.deployed()

    startBlock = await ethers.provider.getBlock("latest");

    const TestStaking = await ethers.getContractFactory('TestStaking')
    testStaking = await upgrades.deployProxy(TestStaking, [testERC721.address, startBlock.timestamp])
    await testStaking.deployed()

    await testStaking.addAdmin(testERC721.address)

    await testERC721.setTestStaking(testStaking.address)

    buyPrice = await testERC721.MINT_PRICE()

    presalePrice = await testERC721.PAPERLIST_MINT_PRICE()
  })

  describe('Token Setup', async () => {
    it('test contracts deployed and tokens set up correctly', async () => {
      const testERC721Name = await testERC721.name()

      expect(testERC721Name).to.equal('TestNFT')
    })
  })

  describe('Mint presale', async () => {
    it('mintPresale success', async () => {

      const userAquantity = 5
      const userBquantity = 5
      const phPlus = true
      const stake = false

      await testERC721.connect(deployer).togglePresale(true, true)

      const userAsignedMessage = await messageSigner.getSignedMessage(phPlus, userA.address, signer)

      await testERC721.connect(userA).presaleMint(userAquantity, phPlus, userAsignedMessage, stake, { value: presalePrice.mul(userAquantity) })
      const userATokenBalance = await testERC721.balanceOf(userA.address)
      expect(userATokenBalance).to.equal(userAquantity)
      expect(await testERC721.totalSupply()).to.equal(userAquantity)

      const userBsignedMessage = await messageSigner.getSignedMessage(phPlus, userB.address, signer)

      await testERC721.connect(userB).presaleMint(userBquantity, phPlus, userBsignedMessage, stake, { value: presalePrice.mul(userBquantity) })
      const userBTokenBalance = await testERC721.balanceOf(userB.address)
      expect(userBTokenBalance).to.equal(userBquantity)
      expect(await testERC721.totalSupply()).to.equal(userAquantity + userBquantity)
    })

    it('mintPresale error exceed quantity', async () => {

      const quantity = 6
      const phPlus = true
      const stake = false

      await testERC721.connect(deployer).togglePresale(true, true)

      const signedMessage = await messageSigner.getSignedMessage(phPlus, userA.address, signer)

      await expect(testERC721.connect(userA).presaleMint(quantity, phPlus, signedMessage, stake, { value: presalePrice.mul(quantity) })).to.be.revertedWith('INVALID_QUANTITY')
    })

    it('mintPresale error message already used', async () => {

      const quantity = 5
      const phPlus = true
      const stake = false

      await testERC721.connect(deployer).togglePresale(true, true)

      const signedMessage = await messageSigner.getSignedMessage(phPlus, userA.address, signer)

      await testERC721.connect(userA).presaleMint(quantity, phPlus, signedMessage, stake, { value: presalePrice.mul(quantity) })

      const secondsignedMessage = await messageSigner.getSignedMessage(phPlus, userA.address, signer)

      await expect(testERC721.connect(userA).presaleMint(1, phPlus, secondsignedMessage, stake, { value: presalePrice.mul(quantity) })).to.be.revertedWith('ALREADY_MINTED')
    })

    it('mintPresale error wrong value input', async () => {

      const quantity = 5
      const phPlus = true
      const stake = false

      await testERC721.connect(deployer).togglePresale(true, true)

      const signedMessage = await messageSigner.getSignedMessage(phPlus, userA.address, signer)

      await expect(testERC721.connect(userA).presaleMint(quantity, phPlus, signedMessage, stake, { value: presalePrice.mul(quantity).sub(1) })).to.be.revertedWith('INSUFFICIENT_ETH')
    })

    it('mintPresale error wrong sender', async () => {

      const quantity = 5
      const phPlus = true
      const stake = false

      await testERC721.connect(deployer).togglePresale(true, true)

      const signedMessage = await messageSigner.getSignedMessage(phPlus, userA.address, signer)

      await expect(testERC721.connect(userB).presaleMint(quantity, phPlus, signedMessage, stake, { value: presalePrice.mul(quantity) })).to.be.revertedWith('UNAUTHORIZED')
    })

    it('mintPresale error when minting phPlus during regular presale', async () => {

      const quantity = 5
      const phPlus = true
      const stake = false

      await testERC721.connect(deployer).togglePresale(true, false)

      const signedMessage = await messageSigner.getSignedMessage(phPlus, userA.address, signer)

      await expect(testERC721.connect(userA).presaleMint(quantity, phPlus, signedMessage, stake, { value: presalePrice.mul(quantity) })).to.be.revertedWith('INVALID_QUANTITY')
    })

    it('mintPresale error when minting regular presale user during phPlus presale', async () => {

      const quantity = 5
      const phPlus = false
      const stake = false

      await testERC721.connect(deployer).togglePresale(true, true)

      const signedMessage = await messageSigner.getSignedMessage(phPlus, userA.address, signer)

      await expect(testERC721.connect(userA).presaleMint(quantity, phPlus, signedMessage, stake, { value: presalePrice.mul(quantity) })).to.be.revertedWith('TOO_EARLY')
    })
  })

  describe('Mint sale', async () => {
    it('mint nft success', async () => {

      const quantity = 3
      const stake = false

      await testERC721.connect(deployer).toggleSale()
      await testERC721.connect(userA).mint(quantity, stake, { value: buyPrice.mul(quantity) })

      const ownerAddress1 = await testERC721.ownerOf(quantity - 1)
      const ownerAddress2 = await testERC721.ownerOf(quantity - 2)
      const ownerAddress3 = await testERC721.ownerOf(quantity - 3)
      await expect(testERC721.ownerOf(quantity)).to.be.revertedWith('OwnerQueryForNonexistentToken()')
      expect(ownerAddress1).to.equal(userA.address)
      expect(ownerAddress2).to.equal(userA.address)
      expect(ownerAddress3).to.equal(userA.address)

      const userATokenBalance = await testERC721.balanceOf(userA.address)
      expect(userATokenBalance).to.equal(quantity)
      expect(await testERC721.totalSupply()).to.equal(quantity)
    })

    it('mint presale and regular sale success', async () => {

      const presaleQuantity = 5
      const quantity = 3
      const phPlus = true
      const stake = false

      await testERC721.connect(deployer).togglePresale(true, true)

      const signedMessage = await messageSigner.getSignedMessage(phPlus, userA.address, signer)

      await testERC721.connect(userA).presaleMint(presaleQuantity, phPlus, signedMessage, stake, { value: presalePrice.mul(presaleQuantity) })

      await testERC721.connect(deployer).toggleSale()
      await testERC721.connect(userA).mint(quantity, stake, { value: buyPrice.mul(quantity) })

      await expect(testERC721.connect(userA).mint(1, stake, { value: buyPrice.mul(1) })).to.be.revertedWith('INVALID_QUANTITY')

      const ownerAddress1 = await testERC721.ownerOf(0)
      const ownerAddress2 = await testERC721.ownerOf(1)
      const ownerAddress3 = await testERC721.ownerOf(2)
      const ownerAddress4 = await testERC721.ownerOf(3)
      const ownerAddress5 = await testERC721.ownerOf(4)
      const ownerAddress6 = await testERC721.ownerOf(5)
      const ownerAddress7 = await testERC721.ownerOf(6)
      const ownerAddress8 = await testERC721.ownerOf(7)
      await expect(testERC721.ownerOf(8)).to.be.revertedWith('OwnerQueryForNonexistentToken()')
      expect(ownerAddress1).to.equal(userA.address)
      expect(ownerAddress2).to.equal(userA.address)
      expect(ownerAddress3).to.equal(userA.address)
      expect(ownerAddress4).to.equal(userA.address)
      expect(ownerAddress5).to.equal(userA.address)
      expect(ownerAddress6).to.equal(userA.address)
      expect(ownerAddress7).to.equal(userA.address)
      expect(ownerAddress8).to.equal(userA.address)

      const userATokenBalance = await testERC721.balanceOf(userA.address)
      expect(userATokenBalance).to.equal(presaleQuantity + quantity)
      expect(await testERC721.totalSupply()).to.equal(presaleQuantity + quantity)
    })

    it('mint sale error exceed quantity', async () => {

      const quantity = 4
      const stake = false

      await testERC721.connect(deployer).toggleSale()
      await expect(testERC721.connect(userA).mint(quantity, stake, { value: buyPrice.mul(quantity) })).to.be.revertedWith('INVALID_QUANTITY')
    })

    it('mint sale error 0 quantity', async () => {

      const quantity = 0
      const stake = false

      await testERC721.connect(deployer).toggleSale()
      await expect(testERC721.connect(userA).mint(quantity, stake, { value: buyPrice.mul(quantity) })).to.be.revertedWith('INVALID_QUANTITY')
    })

    it('mint sale error insufficient funds', async () => {

      const quantity = 3
      const stake = false

      await testERC721.connect(deployer).toggleSale()
      await expect(testERC721.connect(userA).mint(quantity, stake, { value: buyPrice.mul(quantity).sub(1) })).to.be.revertedWith('INSUFFICIENT_ETH')
    })
  })

  describe('NFT transfer', async () => {
    it('nft transfer success', async () => {

      const quantity = 1
      const stake = false

      await testERC721.connect(deployer).toggleSale()
      
      await testERC721.connect(userA).mint(quantity, stake, { value: buyPrice.mul(quantity) })
      const blockTransfer0 = await ethers.provider.getBlock()

      await ethers.provider.send('evm_mine', [blockTransfer0.timestamp + 86393])
      await testERC721.connect(userA).transferFrom(userA.address, userB.address, 0)
      const blockTransfer1 = await ethers.provider.getBlock()
      await ethers.provider.send('evm_mine', [blockTransfer1.timestamp + 86399])
      await testERC721.connect(userB).transferFrom(userB.address, userC.address, 0)
      const blockTransfer2 = await ethers.provider.getBlock()
      await ethers.provider.send('evm_mine', [blockTransfer2.timestamp + 86400])

      const userARewards = await testStaking.viewAllRewards(userA.address)
      const userBRewards = await testStaking.viewAllRewards(userB.address)
      const userCRewards = await testStaking.viewPassivePendingReward(userC.address)
      
      const userAUpdates = await testStaking.lastUpdates(userA.address)
      const userBUpdates = await testStaking.lastUpdates(userB.address)

      const userCUpdates = await testStaking.lastUpdates(userC.address)

      const oneDayOfRewards = BN.from('100000000000000000000') // 100 tokens
      
      expect(userBRewards).to.equal(oneDayOfRewards)
      
      expect(await testStaking.viewPassivePendingReward(userB.address)).to.equal(0)
      expect(userCRewards).to.equal(oneDayOfRewards)

      expect(userAUpdates[0]).to.equal(blockTransfer1.timestamp)

      expect(userBUpdates[0]).to.equal(blockTransfer2.timestamp)
      expect(userCUpdates[0]).to.equal(blockTransfer2.timestamp)

      console.log("this ends up being close enough - exact amount is not calculated due to diff in seconds")
      expect(userARewards).to.equal(oneDayOfRewards) // this will sometimes fail due to diff in seconds
      // this ends up being close enough - exact amount is not calculated due to diff in seconds
    })
  })

  describe('NFT stake', async () => {
    it('nft active success', async () => {

      const quantity = 3
      const stake = false

      await testERC721.connect(deployer).toggleSale()
      
      await testERC721.connect(userA).mint(quantity, stake, { value: buyPrice.mul(quantity) })
      await testERC721.connect(userA).setApprovalForAll(testStaking.address, true)
      const blockTransfer0 = await ethers.provider.getBlock()
      await ethers.provider.send('evm_mine', [blockTransfer0.timestamp + 86393])

      await expect(testStaking.connect(userA).stakeActive(userA.address, [0,2])).to.emit(testStaking, 'Stake')

      const blockTransfer1 = await ethers.provider.getBlock()
      await ethers.provider.send('evm_mine', [blockTransfer1.timestamp + 86400])
      const userARewards = await testStaking.viewAllRewards(userA.address)
      const userAActivePending = await testStaking.viewActivePendingReward(userA.address)
      const userAPassivePending = await testStaking.viewPassivePendingReward(userA.address)

      await expect(testStaking.connect(userA).withdrawActive()).to.emit(testStaking, 'Withdraw')
      const newUserARewards = await testStaking.viewAllRewards(userA.address)

      console.log("this ends up being close enough - exact amount is not calculated due to diff in seconds")
      expect(newUserARewards).to.equal(userARewards.add(userAActivePending).add(userAPassivePending))
      // this ends up being close enough - exact amount is not calculated due to diff in seconds
    })

    it('nft lock success', async () => {

      const quantity = 3
      const stake = false

      await testERC721.connect(deployer).toggleSale()
      
      await testERC721.connect(userA).mint(quantity, stake, { value: buyPrice.mul(quantity) })
      await testERC721.connect(userA).setApprovalForAll(testStaking.address, true)
      const blockTransfer0 = await ethers.provider.getBlock()
      await testStaking.connect(userA).stakeLock(userA.address, [0,1])
      const blockTransfer1 = await ethers.provider.getBlock()
      await ethers.provider.send('evm_mine', [blockTransfer1.timestamp + 259200])
      await testStaking.connect(userA).stakeLock(userA.address, [2])
      const userARewards = await testStaking.viewAllRewards(userA.address)
      await expect(testStaking.connect(userA).withdrawLock()).to.be.revertedWith("NO_UNLOCKED")
      await ethers.provider.send('evm_mine', [blockTransfer1.timestamp + (86400 * 60)])
      const userALockPending = await testStaking.viewLockPendingReward(userA.address)
      const userAPassivePending = await testStaking.viewPassivePendingReward(userA.address)
      await testStaking.connect(userA).withdrawLock()
      const newUserARewards = await testStaking.viewAllRewards(userA.address)

      console.log("this ends up being close enough - exact amount is not calculated due to diff in seconds")
      expect(newUserARewards).to.equal(userARewards.add(userALockPending).add(userAPassivePending))
      // this ends up being close enough - exact amount is not calculated due to diff in seconds
    })
  })

  describe('NFT mint and stake', async () => {
    it('nft presale mint and sale mint and stake success', async () => {

      await testERC721.connect(deployer).releaseReserve(deployer.address, 1)

      const userAquantity = 5
      const phPlus = true
      const stake = true

      await testERC721.connect(deployer).togglePresale(true, true)

      const userAsignedMessage = await messageSigner.getSignedMessage(phPlus, userA.address, signer)

      await testERC721.connect(userA).presaleMint(userAquantity, phPlus, userAsignedMessage, stake, { value: presalePrice.mul(userAquantity) })
      const blockTransfer1 = await ethers.provider.getBlock()

      const userAstakedLockTokens = await testStaking.viewLockTokens(userA.address)
      expect(userAstakedLockTokens.length).to.equal(userAquantity)

      await expect(testStaking.connect(userA).withdrawLock()).to.be.revertedWith("NO_UNLOCKED")
      await ethers.provider.send('evm_mine', [blockTransfer1.timestamp + (86400 * 60)])
      await testStaking.connect(userA).withdrawLock()

      const userAtokenBalance = await testERC721.balanceOf(userA.address)
      expect(userAtokenBalance).to.equal(userAquantity)

      const userBquantity = 3

      await testERC721.connect(deployer).toggleSale()

      await testERC721.connect(userB).mint(userBquantity, stake, { value: buyPrice.mul(userBquantity) })
      const blockTransfer2 = await ethers.provider.getBlock()

      const userBstakedLockTokens = await testStaking.viewLockTokens(userB.address)
      expect(userBstakedLockTokens.length).to.equal(userBquantity)

      await expect(testStaking.connect(userB).withdrawLock()).to.be.revertedWith("NO_UNLOCKED")
      await ethers.provider.send('evm_mine', [blockTransfer2.timestamp + (86400 * 60)])
      await testStaking.connect(userB).withdrawLock()

      const walletofOwner = await testERC721.walletOfOwner(userB.address)

      const userBtokenBalance = await testERC721.balanceOf(userB.address)
      expect(userBtokenBalance).to.equal(userBquantity)
      expect(walletofOwner.length).to.equal(userBquantity)
    })
  })
})
