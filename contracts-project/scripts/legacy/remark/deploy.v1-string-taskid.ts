import { network } from "hardhat";

/// @notice Legacy: deploy the old string-taskId remark logic behind Proxy.
async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  const platformWallet = deployer.address;

  console.log("[legacy/remark] Deploying LEGACY LogicV1(string taskId) with account:", platformWallet);

  const logic = await ethers.deployContract("contracts/legacy/LogicV1.sol:LogicV1");
  await logic.waitForDeployment();
  const logicAddress = await logic.getAddress();
  console.log("[legacy/remark] Legacy LogicV1 deployed to:", logicAddress);

  const proxy = await ethers.deployContract("contracts/Proxy.sol:Proxy", [logicAddress, platformWallet]);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log("[legacy/remark] Proxy deployed to:", proxyAddress);

  const logicViaProxy = await ethers.getContractAt("contracts/legacy/LogicV1.sol:LogicV1", proxyAddress);
  const tx = await logicViaProxy.initialize(platformWallet);
  await tx.wait();
  console.log("[legacy/remark] Proxy initialized, owner:", platformWallet);

  console.log("\n=== LEGACY remark proxy address ===");
  console.log("LEGACY_REMARK_PROXY_ADDRESS=" + proxyAddress);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

