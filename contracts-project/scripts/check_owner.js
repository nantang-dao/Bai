import hardhat from "hardhat";

async function main() {
  const proxyAddress = "0x6C69e9a7cF3CE79B020020C8b1bd4f96A08d25B4";
  
  const RemarkLogicV1 = await hardhat.ethers.getContractFactory("RemarkLogicV1");
  const logic = RemarkLogicV1.attach(proxyAddress);
  
  const owner = await logic.owner();
  console.log("Current proxy owner:", owner);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
