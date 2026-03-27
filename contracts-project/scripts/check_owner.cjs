const { ethers } = require("hardhat");

async function main() {
    const proxyAddress = "0x6C69e9a7cF3CE79B020020C8b1bd4f96A08d25B4";
    const RemarkLogicV1 = await ethers.getContractFactory("RemarkLogicV1");
    const remark = RemarkLogicV1.attach(proxyAddress);
    
    try {
        const owner = await remark.owner();
        console.log("Current proxy owner:", owner);
    } catch(e) {
        console.log("Error getting owner:", e.message);
    }
}

main().catch(console.error);
