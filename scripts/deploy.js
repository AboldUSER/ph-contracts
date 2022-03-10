// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const {ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log(`Deployer: ${deployer.address}`)

  const chainId = await deployer.getChainId()

  console.log(`Deploying on ${chainId}`)

  // const baseURI = "https://testnft.com/metadata/"; ///placeholder
  const signer = deployer.address; ///placeholder

  const TestERC721 = await ethers.getContractFactory("TestERC721");
  const testERC721 = await upgrades.deployProxy(TestERC721, [signer]);

  await testERC721.deployed();
  console.log("TestERC721 deployed to:", testERC721.address);

  const stakingStartTime = 1647210600 // Sunday, March 13, 2022 3:30:00 PM GMT-07:00 DST (California Time)

  const TestStaking = await ethers.getContractFactory("TestStaking");
  const testStaking = await upgrades.deployProxy(TestStaking, [testERC721.address, stakingStartTime])

  await testStaking.deployed();
  console.log("TestStaking deployed to:", testStaking.address);

  // console.log('Waiting to verify...')
  // await new Promise((r) => setTimeout(r, 60000))

  // await run('verify:verify', {
  //   address: testERC721.address,
  //   constructorArguments: [signer],
  // })
  // console.log('Verified testERC721')

  // await run('verify:verify', {
  //   address: testStaking.address,
  //   constructorArguments: [testERC721.address, stakingStartTime],
  // })
  // console.log('Verified testStaking')

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
