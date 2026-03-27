import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);

  const proxyAddress =
    process.env.REMARK_PROXY_ADDRESS || "0xe7C8244D80F4A3C2e4C8FE04197d38E87571Df58";

  console.log("Deploying new RemarkLogicV1...");
  const logic = await ethers.deployContract("RemarkLogicV1");
  await logic.waitForDeployment();
  const logicAddress = await logic.getAddress();
  console.log("New RemarkLogicV1 deployed to:", logicAddress);

  console.log(`Upgrading Proxy at ${proxyAddress} to new logic...`);
  // Use the Proxy ABI to call upgradeTo
  const proxy = await ethers.getContractAt("Proxy", proxyAddress);
  const tx = await proxy.upgradeTo(logicAddress);
  await tx.wait();
  console.log("Upgrade successful!");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
