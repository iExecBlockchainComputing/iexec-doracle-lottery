const { ethers } = require('ethers');
const iexec      = require('iexec');

const RLC     = require("rlc-faucet-contract/build/contracts/RLC.json");
const CLERK   = require("iexec-poco/build/contracts-min/IexecClerk.json");
const LOTTERY = require("../build/contracts/Lottery.json");

const CHAIN           = "kovan";
const LOTTERY_ADDR    = "0x60e3076D1b513658A0A1fBcb79417A9DB6844fa1";
const APP_ADDR        = "0xB43c71cb72A1EA1CAcF3F30F476155F48285F790";
const DATASET_ADDR    = undefined;
const WORKERPOOL_ADDR = undefined;
const CATEGORY        = 2;

var lottery = null;
var rlc     = null;


async function deposit(wallet, amount)
{
	return (await rlc.connect(wallet).approveAndCall(lottery.address, amount, "0x")).wait();
}
async function viewLottery(id)
{
	const details   = await lottery.lotteryDetails(id);
	const now       = Date.now()/1000;
	const remaining = details.registrationDeadline - now;
	const reached   = remaining < 0;

	console.log(`Ticket price:      ${details.ticketPrice.toString()}`);
	console.log(`Value in pot:      ${details.potValue.toString()}`);
	console.log(`Number of tickets: ${details.maxParticipants.toString()}`);
	console.log(`Deadline:          ${details.registrationDeadline.toString()}`);
	console.log(`Status:            ${reached?"Closed":"Open"}`);
	if (!reached)
	{
		console.log(`→ remaining:       ${remaining}`);
	}
	else
	{
		console.log(`→ oracleCall:      ${details.oracleCall.toString()}`);
	};
}








(async () => {

	const provider = ethers.getDefaultProvider(CHAIN);
	const wallet   = new ethers.Wallet(process.env.MNEMONIC, provider);
	const { name, chainId } = await provider.ready;

	lottery = new ethers.Contract(LOTTERY_ADDR,               LOTTERY.abi, wallet);
	clerk   = new ethers.Contract(await lottery.iexecClerk(), CLERK.abi,   wallet);
	rlc     = new ethers.Contract(await lottery.token(),      RLC.abi,    wallet);

	console.log(wallet.address);
	console.log("------------ BEFORE ------------");
	console.log("RLC     balance", Number(await rlc.balanceOf(wallet.address)));
	console.log("Lottery balance", Number(await lottery.balanceOf(wallet.address)));
	console.log("--------------------------------");

	const lotteryID = 0;

	if (false)
	{
		console.log("DEPOSIT");
		await deposit(wallet, 360);
	}

	if (false)
	{
		console.log("CREATE & BUY");

		await (await lottery.createLottery(60, 5, 30)).wait();
		await (await lottery.buyTicket(lotteryID)).wait();
		await (await lottery.buyTicket(lotteryID)).wait();
	}

	if (false)
	{
		console.log("ROOL");

		const apporder =
			(await iexec.orderbook.fetchAppOrderbook(chainId, APP_ADDR))
			.appOrders
			.filter(e => e.status == 'open')
			.sort((e1, e2) => e1.order.appprice - e2.order.appprice)
			[0]
			.order

		const datasetorder =
			DATASET_ADDR
			? (await iexec.orderbook.fetchDatasetOrderbook(chainId, DATASET_ADDR))
				.datasetOrders
				.filter(e => e.status == 'open')
				.sort((e1, e2) => e1.order.datasetprice - e2.order.datasetprice)
				[0]
				.order
			: iexec.order.NULL_DATASETORDER;

		const workerpoolorder =
			(await iexec.orderbook.fetchWorkerpoolOrderbook(chainId, CATEGORY.toString(), WORKERPOOL_ADDR ? { WORKERPOOL_ADDR } : {}))
			.workerpoolOrders
			.filter(e => e.status == 'open')
			.sort((e1, e2) => e1.order.workerpoolprice - e2.order.workerpoolprice)
			[0]
			.order

		await (await lottery.roll(lotteryID, apporder, datasetorder, workerpoolorder)).wait()
	}

	await viewLottery(lotteryID);

	console.log("------------ AFTER ------------");
	console.log("RLC     balance", Number(await rlc.balanceOf(wallet.address)));
	console.log("Lottery balance", Number(await lottery.balanceOf(wallet.address)));
	console.log("-------------------------------");





})();
