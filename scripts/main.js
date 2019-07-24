const { ethers } = require('ethers');
const iexec      = require('iexec');

const RLC     = require("rlc-faucet-contract/build/contracts/RLC.json");
const CLERK   = require("iexec-poco/build/contracts-min/IexecClerk.json");
const LOTTERY = require("../build/contracts/Lottery.json");

const CHAIN           = "kovan";
const LOTTERY_ADDR    = "0x5eBD616389e5BC21fbbE570a435F081991b9f9F3";

const APP_ADDR        = "0xB43c71cb72A1EA1CAcF3F30F476155F48285F790";
const DATASET_ADDR    = undefined;
const WORKERPOOL_ADDR = "0xE4F0A428c71e9C9647907Fb339991748fC345413";
// const WORKERPOOL_ADDR = undefined;
const CATEGORIES      = [0,1,2,3,4];

ethers.errors.setLogLevel("error");

var lottery = null;
var rlc     = null;

function statusToString(status)
{
	switch(status.toString())
	{
		case '0': return 'NULL';     break;
		case '1': return 'OPEN';     break;
		case '2': return 'ROLLING';  break;
		case '3': return 'FINISHED'; break;
	}
}

function viewLottery(lotteryID)
{
	return new Promise((resolve, reject) => {
		lottery
		.lotteryMetadata(lotteryID)
		.then(details => {
			const remaining = details.crowdsaleDeadline - Date.now() / 1000;
			const reached   = remaining < 0;

			console.log(`Status:          ${statusToString(details.status)}`);
			console.log(`Ticket price:    ${details.ticketPrice.toString()}`);
			console.log(`Value in pot:    ${details.potValue.toString()}`);
			console.log(`Tickets sold:    ${details.ticketCount.toString()}`);
			console.log(`Tickets maximum: ${details.ticketMaxCount.toString()}`);
			console.log(`Deadline:        ${details.crowdsaleDeadline.toString()}`);
			console.log(`Crowd sale:      ${reached?"Closed":"Open"}`);
			if (!reached)
			{
				console.log(`→ remaining:       ${remaining}`);
			}
			console.log(`→ oracleCall:      ${details.oracleCall.toString()}`);
		})
		.catch(() => {
			console.log(`Invalid lotteryID: ${lotteryID}`);
		})
		.finally(() => {
			resolve(null);
		});
	});
}

function buyTicket(wallet, lotteryID)
{
	return new Promise((resolve, reject) => {
		lottery
		.lotteryMetadata(lotteryID)
		.then( ({ ticketPrice }) => {
			rlc
			.connect(wallet)
			.approveAndCall(lottery.address, ticketPrice, ethers.utils.defaultAbiCoder.encode(["uint256"], [lotteryID]))
			.then(txPromise => {
				txPromise
				.wait()
				.then(resolve)
				.catch(reject);
			})
			.catch(reject);
		})
		.catch(reject);
	});
}

function getAppOrder(chainId, app)
{
	return new Promise((resolve, reject) => {
		iexec.orderbook.fetchAppOrderbook(chainId, app)
		.then(orderbook => {
			resolve(
				orderbook
				.appOrders
				.filter(e => e.status == 'open')
				// .filter(e => e.order.tag == )
				.sort((e1, e2) => e1.order.appprice - e2.order.appprice)
				[0]
				.order
			)
		})
		.catch(reject);
	});
}

function getDatasetOrder(chainId, dataset)
{
	return new Promise((resolve, reject) => {
		if (dataset)
		{
			iexec.orderbook.fetchDatasetOrderbook(chainId, dataset)
			.then(orderbook => {
				resolve(
					orderbook
					.datasetOrders
					.filter(e => e.status == 'open')
					// .filter(e => e.order.tag == )
					.sort((e1, e2) => e1.order.datasetprice - e2.order.datasetprice)
					[0]
					.order
				)
			})
			.catch(reject);
		}
		else
		{
			resolve(iexec.order.NULL_DATASETORDER);
		}
	});
}

function getWorkerpoolOrder(chainId, workerpool = undefined)
{
	return new Promise((resolve, reject) => {
		Promise.all(CATEGORIES.map(cat => iexec.orderbook.fetchWorkerpoolOrderbook(chainId, cat.toString(), {})))
		.then(orderbooks => {
			resolve(
				[]
				.concat(...orderbooks.map(e => e.workerpoolOrders))
				.filter(e => e.status == 'open')
				.filter(e => !workerpool || e.order.workerpool == workerpool)
				// .filter(e => e.order.tag == )
				.sort((e1, e2) => e1.order.workerpoolprice - e2.order.workerpoolprice)
				[0]
				.order
			);
		})
		.catch(reject);
	});
}

function roll(lotteryID)
{
	return new Promise(async (resolve, reject) => {
		const { chainId } = await lottery.provider.ready;
		Promise.all([
			getAppOrder       (chainId, APP_ADDR       ),
			getDatasetOrder   (chainId, DATASET_ADDR   ),
			getWorkerpoolOrder(chainId, WORKERPOOL_ADDR),
		])
		.then(orders => {
			lottery
			.roll(lotteryID, ...orders)
			.then(txPromise => {
				txPromise
				.wait()
				.then(resolve)
				.catch(reject);
			})
			.catch(reject);
		})
		.catch(reject);
	});
}

function claim(lotteryID)
{
	return new Promise(async (resolve, reject) => {
		lottery
		.claim(lotteryID)
		.then(txPromise => {
			txPromise
			.wait()
			.then(resolve)
			.catch(reject);
		})
		.catch(reject);
	});
}

function receiveResult(lotteryID)
{
	return new Promise((resolve, reject) => {
		lottery
		.lotteryMetadata(lotteryID)
		.then( ({ oracleCall }) => {
			lottery
			.receiveResult(oracleCall, "0x")
			.then(txPromise => {
				txPromise
				.wait()
				.then(resolve)
				.catch(e => reject("#1: " + e));
			})
			.catch(e => reject("#2: " + e));
		})
		.catch(reject);
	});
}




(async () => {

	const provider = ethers.getDefaultProvider(CHAIN);
	const wallet   = new ethers.Wallet(process.env.MNEMONIC, provider);
	const wallet2  = new ethers.Wallet("0x564a9db84969c8159f7aa3d5393c5ecd014fce6a375842a45b12af6677b12407", provider);

	lottery = new ethers.Contract(LOTTERY_ADDR,          LOTTERY.abi, wallet);
	rlc     = new ethers.Contract(await lottery.token(), RLC.abi,     wallet);

	console.log("------------ BEFORE ------------");
	console.log(`Wallet address: ${wallet.address}`);
	console.log(`RLC balance:    ${(await rlc.balanceOf(wallet.address)).toString()}`);
	console.log("--------------------------------");

	const lotteryID = 3;

	// CREATE - OK
	// await (await lottery.createLottery(10, 10, 600)).wait();

	// BUY - OK
	// await buyTicket(wallet, lotteryID);
	// await buyTicket(wallet, lotteryID);

	// ROOL - DEBUG
	// await roll(lotteryID)

	// CLAIM - DEBUG
	// await claim(lotteryID);

	// Force result
	// await receiveResult(lotteryID);


	await viewLottery(lotteryID);


	console.log("------------ AFTER ------------");
	console.log(`RLC balance:    ${(await rlc.balanceOf(wallet.address)).toString()}`);
	console.log("-------------------------------");





})();
