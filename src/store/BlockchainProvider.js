import React from "react";
import { EventEmitter } from 'fbemitter';
import { ethers } from 'ethers';

import defaultConfig from '../config/config';
import LOTTERY       from '../contracts/Lottery.json';
import RLC           from 'rlc-faucet-contract/build/contracts/RLC.json';

export const BlockchainContext = React.createContext({});

class BlockchainProvider extends React.Component
{
	constructor(props)
	{
		super(props);
		this.state = {
			// variables
			emitter:      new EventEmitter(),
			provider:     new ethers.providers.Web3Provider(window.ethereum),
			config:       defaultConfig,
			contracts:    {},
			balance:      null,
			tickets:      {},
			// methods
			getNetwork:   this.getNetwork,
			getWallet:    this.getWallet,
			getBalance:   this.getBalance,
			fetchBalance: this.fetchBalance,
			getTicket:    this.getTicket,
			fetchTicket:  this.fetchTicket,
		}
	}


	componentDidMount()
	{
		window.ethereum.enable()
		.then(() => {
			this.start().then(() => {
				window.ethereum.on('networkChanged',  this.restart);
				window.ethereum.on('accountsChanged', this.restart);
			});
		});
	}

	componentWillUnmount()
	{
		this.stop();
	}

	start = () => new Promise(async (resolve, reject) => {
		try
		{
			const lotteryAddr = this.getNetwork().lottery;
			const lottery     = new ethers.Contract(lotteryAddr,           LOTTERY.abi, this.state.provider.getSigner());
			const token       = new ethers.Contract(await lottery.token(), RLC.abi,     this.state.provider.getSigner());

			this.setState({
				connected: true,
				contracts: { lottery, token },
				balance:   null,
				tickets:   {},
			});

			this.state.contracts.token.addListener(this.state.contracts.token.filters.Transfer(null, this.state.getWallet()), this.onERC20Transfer);
			this.state.contracts.token.addListener(this.state.contracts.token.filters.Transfer(this.state.getWallet(), null), this.onERC20Transfer);
			this.state.contracts.lottery.addListener("Transfer",       this.onERC721Transfer);
			this.state.contracts.lottery.addListener("NewLottery",     this.onNewLottery);
			this.state.contracts.lottery.addListener("NewParticipant", this.onNewParticipant);
			this.state.contracts.lottery.addListener("NewRoll",        this.onNewRoll);
			this.state.contracts.lottery.addListener("Reward",         this.onReward);
			this.state.contracts.lottery.addListener("Faillure",       this.onFaillure);
			this.state.contracts.lottery.addListener("Claim",          this.onClaim);

			// initialize
			this.fetchBalance();
			this.fetchAllTickets();
			this.onNewLottery(null);

			// notify
			this.state.emitter.emit('Notify', 'success', 'Connection successfull');
		}
		catch
		{
			this.setState({
				connected: false,
				contracts: {},
				balance:   null,
				tickets:   {},
			});

			// reset
			this.onNewLottery(null);

			// notify
			this.state.emitter.emit('Notify', 'error', 'Please switch to kovan.', 'Lottery unavailable on this network');
		}
		resolve();
	})

	stop = () => new Promise(async (resolve, reject) => {
		if (this.state.connected)
		{
			this.state.contracts.token.removeListener(this.state.contracts.token.filters.Transfer(null, this.state.getWallet()), this.onERC20Transfer);
			this.state.contracts.token.removeListener(this.state.contracts.token.filters.Transfer(this.state.getWallet(), null), this.onERC20Transfer);
			this.state.contracts.lottery.removeListener("Transfer",       this.onERC721Transfer);
			this.state.contracts.lottery.removeListener("NewLottery",     this.onNewLottery);
			this.state.contracts.lottery.removeListener("NewParticipant", this.onNewParticipant);
			this.state.contracts.lottery.removeListener("NewRoll",        this.onNewRoll);
			this.state.contracts.lottery.removeListener("Reward",         this.onReward);
			this.state.contracts.lottery.removeListener("Faillure",       this.onFaillure);
			this.state.contracts.lottery.removeListener("Claim",          this.onClaim);
		}
		resolve();
	})

	restart = () => new Promise((resolve, reject) => {
		this.stop()
		.then(() => {
			this.start()
			.then(resolve)
			.catch(reject);
		})
		.catch(reject);
	})

	onNewLottery     = (lotteryid               ) => { this.state.emitter.emit('NewLottery',     lotteryid); }
	onNewParticipant = (lotteryid, ticketid     ) => { this.state.emitter.emit('NewParticipant', lotteryid); }
	onNewRoll        = (lotteryid, taskid       ) => { this.state.emitter.emit('NewRoll',        lotteryid); }
	onReward         = (lotteryid, winner, value) => { this.state.emitter.emit('Reward',         lotteryid); }
	onFaillure       = (lotteryid               ) => { this.state.emitter.emit('Faillure',       lotteryid); }
	onClaim          = (lotteryid               ) => { this.state.emitter.emit('Claim',          lotteryid); }
	onERC20Transfer  = (from, to, value         ) => { this.fetchBalance();                                  }
	onERC721Transfer = (from, to, tokenID       ) => { this.fetchTicket(tokenID);                            }

	getNetwork = (chainId = window.ethereum.networkVersion) => {
		return { chainId, ...this.state.config.networks[chainId] };
	}

	getWallet = () => {
		return ethers.utils.getAddress(window.ethereum.selectedAddress);
	}

	getBalance = () => {
		return this.state.balance;
	}

	fetchBalance = async () => {
		this.setState({
			balance: await this.state.contracts.token.balanceOf(this.getWallet()),
		});
	}

	getTicket = (id) => {
		return this.state.tickets[id];
	}

	fetchTicket = async (id) => {
		const owner = await this.state.contracts.lottery.ownerOf(id);

		if (owner === this.getWallet())
		{
			this.state.tickets[id] = await this.state.contracts.lottery.viewTicket(id);
		}
		else
		{
			delete this.state.tickets[id];
		}
	}

	fetchAllTickets = (id) => {
		this.state.contracts.lottery.balanceOf(this.getWallet())
		.then(count => {
			Promise.all(
				[...Array(count.toNumber()).keys()]
				.map(index => this.state.contracts.lottery.tokenOfOwnerByIndex(this.getWallet(), index))
			)
			.then(tokenIDs => tokenIDs.forEach(this.fetchTicket));
		});
	}



























	render() {
		return (
			<BlockchainContext.Provider value={this.state}>
				{this.props.children}
			</BlockchainContext.Provider>
		);
	}
}

export default BlockchainProvider;

export const withBlockchain = Component => props => (
	<BlockchainContext.Consumer>
		{ context => <Component {...props} context={context} /> }
	</BlockchainContext.Consumer>
)
