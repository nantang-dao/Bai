import "dotenv/config";
import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  const admin = deployer.address;

  const ntAddress =
    process.env.NT_TOKEN_ADDRESS ||
    "0x7563cb33148cD2b929ed85e69F697be13b515Bd0";

  console.log("[taskpool] Deploying with account:", admin);
  console.log("[taskpool] Using NT token address:", ntAddress);

  const taskPoolLogic = await ethers.deployContract("TaskPoolLogicV1");
  await taskPoolLogic.waitForDeployment();
  const taskPoolLogicAddr = await taskPoolLogic.getAddress();
  console.log("[taskpool] TaskPoolLogicV1 deployed to:", taskPoolLogicAddr);

  const proxy = await ethers.deployContract("contracts/Proxy.sol:Proxy", [
    taskPoolLogicAddr,
    admin,
  ]);
  await proxy.waitForDeployment();
  const proxyAddr = await proxy.getAddress();
  console.log("[taskpool] Proxy deployed to:", proxyAddr);

  const taskPoolViaProxy = await ethers.getContractAt("TaskPoolLogicV1", proxyAddr);
  const tx = await taskPoolViaProxy.initialize(ntAddress, admin);
  await tx.wait();
  console.log("[taskpool] Proxy initialized.");

  console.log("\n=== TaskPool proxy address ===");
  console.log("TASKPOOL_PROXY_ADDRESS=" + proxyAddr);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

