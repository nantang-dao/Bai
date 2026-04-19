/**
 * TaskPool V3：升级现有 Proxy 的实现地址（不更换 Proxy）。
 *
 * 用法：
 *   TASKPOOL_PROXY_ADDRESS=0x... PRIVATE_KEY=... OP_RPC_URL=... npm run upgrade:taskpool:optimism
 */
import "dotenv/config";
import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();

  const proxyAddr = (process.env.TASKPOOL_PROXY_ADDRESS || "").trim();
  if (!proxyAddr) {
    throw new Error("缺少环境变量 TASKPOOL_PROXY_ADDRESS（要升级的 Proxy 地址）");
  }

  console.log("[taskpool] Upgrading proxy:", proxyAddr);
  console.log("[taskpool] Upgrader (EOA):", deployer.address);

  // 1) 读 Proxy 当前 admin / implementation
  const proxy = await ethers.getContractAt("contracts/Proxy.sol:Proxy", proxyAddr);
  const currentAdmin = await proxy.admin();
  const currentImpl = await proxy.implementation();
  console.log("[taskpool] Proxy admin:", currentAdmin);
  console.log("[taskpool] Current implementation:", currentImpl);

  if (currentAdmin.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(
      `[taskpool] 当前签名账户不是 Proxy admin，无法升级。admin=${currentAdmin}, signer=${deployer.address}`
    );
  }

  // 2) 部署新实现（V3）
  const impl = await ethers.deployContract("TaskPoolLogicV3");
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log("[taskpool] TaskPoolLogicV3 deployed to:", implAddr);

  // 3) 升级 Proxy
  const tx = await proxy.upgradeTo(implAddr);
  console.log("[taskpool] upgradeTo tx:", tx.hash);
  await tx.wait();

  // 4) 复查
  const nextImpl = await proxy.implementation();
  console.log("[taskpool] New implementation:", nextImpl);
  if (nextImpl.toLowerCase() !== implAddr.toLowerCase()) {
    throw new Error("[taskpool] 升级后 implementation 未生效，请检查交易与链上状态");
  }

  console.log("\n=== TaskPool upgrade done ===");
  console.log("TASKPOOL_PROXY_ADDRESS=" + proxyAddr);
  console.log("TASKPOOL_LOGIC_V3_ADDRESS=" + implAddr);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

