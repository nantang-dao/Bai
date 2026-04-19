/**
 * TaskPool V2：部署顺序 = 逻辑合约 → 新建 Proxy(implementation, admin) → 在 Proxy 地址上调用 initialize。
 * 复用 contracts/Proxy.sol 字节码即可；Remark 与 TaskPool 各用独立 Proxy 实例，勿共用同一代理地址。
 * EIP-712 verifyingContract 必须填 Proxy 地址。
 *
 * 用法：npm run deploy:taskpool
 * Sepolia：PRIVATE_KEY=... NT_TOKEN_ADDRESS=... RPC_URL=... npm run deploy:taskpool:sepolia
 */
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

  const taskPoolLogic = await ethers.deployContract("TaskPoolLogicV3");
  await taskPoolLogic.waitForDeployment();
  const taskPoolLogicAddr = await taskPoolLogic.getAddress();
  console.log("[taskpool] TaskPoolLogicV3 deployed to:", taskPoolLogicAddr);

  const proxy = await ethers.deployContract("contracts/Proxy.sol:Proxy", [
    taskPoolLogicAddr,
    admin,
  ]);
  await proxy.waitForDeployment();
  const proxyAddr = await proxy.getAddress();
  console.log("[taskpool] Proxy deployed to:", proxyAddr);

  const taskPoolViaProxy = await ethers.getContractAt("TaskPoolLogicV3", proxyAddr);
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

