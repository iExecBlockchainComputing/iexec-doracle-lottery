var Lottery = artifacts.require("Lottery");

module.exports = async function(deployer, network, accounts)
{
	console.log(`web3: ${web3.version}`);

	switch (network)
	{
		case "kovan":
		case "kovan-fork":
			iexecHubAddr = "0xb3901d04CF645747b99DBbe8f2eE9cb41A89CeBF";
			app          = "0x4CB972bfA764D6bc220aaf7FCd4c72fbd05fA3a1";
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
