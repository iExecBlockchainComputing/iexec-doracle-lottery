var Lottery = artifacts.require("Lottery");

module.exports = async function(deployer, network, accounts)
{
	// chainId   = await web3.eth.net.getId();
	// chainType = await web3.eth.net.getNetworkType();
	console.log(`web3:      ${web3.version}`);
	// console.log(`chainId:   ${chainId}`);
	// console.log(`chainType: ${chainType}`);

	switch (network)
	{
		case "kovan":
		case "kovan-fork":
			iexecHubAddr = "0xb3901d04CF645747b99DBbe8f2eE9cb41A89CeBF";
			app          = "0xB43c71cb72A1EA1CAcF3F30F476155F48285F790";
			dataset      = "0x0000000000000000000000000000000000000000"; // ANY
			workerpool   = "0x0000000000000000000000000000000000000000"; // ANY
			break;

		default:
			console.log(`[ERROR] Migration to network ${network} is not configured`);
			return 1;
			break;
	}

	await deployer.deploy(
		Lottery,
		iexecHubAddr,
		app,
		dataset,
		workerpool
	);
	LotteryInstance = await Lottery.deployed();
	console.log("Lottery deployed at address: " + Lottery.address);
};
