import { ethers } from "ethers";

/**
 * Set TaskPool remarkProxy on Optimism.
 *
 * Usage:
 *   TASKPOOL_PROXY_ADDRESS=0x... REMARK_PROXY_ADDRESS=0x... npx hardhat run scripts/taskpool/set-remark-proxy.ts --network optimism
 *
 * Requirements:
 * - hardhat.config.ts must have optimism network configured (it does)
 * - PRIVATE_KEY must be set in environment (hardhat will use it)
 */
async function main() {
  const taskpoolProxy = (process.env.TASKPOOL_PROXY_ADDRESS || "").trim();
  const remarkProxy = (process.env.REMARK_PROXY_ADDRESS || "").trim();

  if (!/^0x[0-9a-fA-F]{40}$/.test(taskpoolProxy)) {
    throw new Error("Missing/invalid TASKPOOL_PROXY_ADDRESS");
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(remarkProxy)) {
    throw new Error("Missing/invalid REMARK_PROXY_ADDRESS");
  }
  if (!process.env.PRIVATE_KEY?.trim()) {
    throw new Error("Missing PRIVATE_KEY in environment");
  }

  const rpcUrl =
    (process.env.OP_RPC_URL || "").trim() ||
    "https://optimism.publicnode.com";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!.trim(), provider);
  const signerAddr = await signer.getAddress();
  console.log("[set-remark-proxy] signer =", signerAddr);
  console.log("[set-remark-proxy] rpc =", rpcUrl);
  console.log("[set-remark-proxy] taskpoolProxy =", taskpoolProxy);
  console.log("[set-remark-proxy] remarkProxy =", remarkProxy);

  const abi = [
    "function remarkProxy() view returns (address)",
    "function setRemarkProxy(address _remarkProxy)",
  ] as const;
  const c = new ethers.Contract(taskpoolProxy, abi, signer);

  const before = (await c.remarkProxy()) as string;
  console.log("[set-remark-proxy] remarkProxy(before) =", before);

  if (before.toLowerCase() === remarkProxy.toLowerCase()) {
    console.log("[set-remark-proxy] already set, skip");
    return;
  }

  const tx = await c.setRemarkProxy(remarkProxy);
  console.log("[set-remark-proxy] txHash =", tx.hash);
  const receipt = await tx.wait();
  console.log("[set-remark-proxy] mined in block =", receipt?.blockNumber);

  const after = (await c.remarkProxy()) as string;
  console.log("[set-remark-proxy] remarkProxy(after) =", after);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

