const { developmentChains } = require("../helper-hardhat-config");
const BASE_FEE = ethers.utils.parseEther("0.25"); //constructor(uint96 _baseFee, uint96 _gasPriceLink)
const GAS_PRICE_LINK = 1e9; //link per gas. calculated valuse based on the gas price of the chain
// So they price of requests change based on the price of gas
module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const args = [BASE_FEE, GAS_PRICE_LINK];

  if (developmentChains.includes(network.name)) {
    log("local network detected! Deploying mocks...");
    //deploy a mock vrfcoordinator
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: args,
    });
    log("Mocks Deployed!!");
    log("---------------------------------------------");
  }
};

module.exports.tags = ["all", "mocks"];
