/**
 * 用 ethers 计算 CreatePool digest / packed 哈希，便于与前端 viem 对拍。
 * 运行：npx hardhat run scripts/taskpool/verify-eip712.ts
 */
import { keccak256, solidityPacked, TypedDataEncoder } from "ethers";

function hashPackedUint256Array(values: bigint[]): string {
  if (values.length === 0) return keccak256("0x");
  const types = values.map(() => "uint256" as const);
  return keccak256(solidityPacked(types, values));
}

async function main() {
  const proxy = "0x3A612F0e8D3942fEb6E2f48AfEbaCFa5ED7bb749";
  const chainId = 10n;

  const domain = {
    name: "TaskPool",
    version: "4",
    chainId,
    verifyingContract: proxy,
  };

  const types = {
    CreateTaskPool: [
      { name: "poolId", type: "uint256" },
      { name: "publisher", type: "address" },
      { name: "manager", type: "address" },
      { name: "taskIdsHash", type: "bytes32" },
      { name: "taskMaxAmountsHash", type: "bytes32" },
      { name: "lockedBalance", type: "uint256" },
      { name: "claimDeadline", type: "uint256" },
      { name: "credentialDeadline", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "sigDeadline", type: "uint256" },
    ],
  };

  const taskIds = [1n, 2n];
  const amounts = [100n, 200n];
  const taskIdsHash = hashPackedUint256Array(taskIds);
  const taskMaxAmountsHash = hashPackedUint256Array(amounts);

  const message = {
    poolId: 42n,
    publisher: "0x0000000000000000000000000000000000000001",
    manager: "0x0000000000000000000000000000000000000002",
    taskIdsHash,
    taskMaxAmountsHash,
    lockedBalance: 300n,
    claimDeadline: 1000n,
    credentialDeadline: 2000n,
    nonce: 0n,
    sigDeadline: 9999999999n,
  };

  const digest = TypedDataEncoder.hash(domain, types, message);
  console.log("[verify-eip712] taskIdsHash:", taskIdsHash);
  console.log("[verify-eip712] taskMaxAmountsHash:", taskMaxAmountsHash);
  console.log("[verify-eip712] CreatePool TypedData digest:", digest);
  console.log(
    "前端可用相同 message + hashCreatePoolTypedData(10, proxy, message) 对比此 digest"
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
