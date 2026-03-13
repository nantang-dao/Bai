import { network } from "hardhat";

async function main() {
    const { ethers } = await network.connect();
    const [deployer] = await ethers.getSigners();
    const platformWallet = deployer.address;

    console.log("Deploying with account:", platformWallet);

    const logic = await ethers.deployContract("LogicV1");
    await logic.waitForDeployment();
    const logicAddress = await logic.getAddress();
    console.log("LogicV1 deployed to:", logicAddress);

    const proxy = await ethers.deployContract("contracts/Proxy.sol:Proxy", [logicAddress, platformWallet]);
    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();
    console.log("Proxy deployed to:", proxyAddress);

    const logicViaProxy = await ethers.getContractAt("LogicV1", proxyAddress);
    const tx = await logicViaProxy.initialize(platformWallet);
    await tx.wait();
    console.log("Proxy initialized, owner:", platformWallet);

    console.log("\n=== 请将以下 Proxy 地址配置到 semi-backend ===");
    console.log("PROXY_CONTRACT_ADDRESS=" + proxyAddress);
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
