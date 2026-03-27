import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  const admin = deployer.address;

  console.log("[remark] Deploying with account:", admin);

  const logic = await ethers.deployContract("RemarkLogicV1");
  await logic.waitForDeployment();
  const logicAddress = await logic.getAddress();
  console.log("[remark] RemarkLogicV1 deployed to:", logicAddress);

  const proxy = await ethers.deployContract("contracts/Proxy.sol:Proxy", [
    logicAddress,
    admin,
  ]);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log("[remark] Proxy deployed to:", proxyAddress);

  console.log("\n=== Remark proxy address ===");
  console.log("REMARK_PROXY_ADDRESS=" + proxyAddress);
  console.log("REMARK_LOGIC_ADDRESS=" + logicAddress);
  console.log("REMARK_PROXY_ADMIN=" + admin);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

