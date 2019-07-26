import React from "react";
import { EventEmitter } from 'fbemitter';
import { ethers } from 'ethers';

import Context    from '../context';

import baseConfig from '../config/config';
import LOTTERY    from '../contracts/Lottery.json';
import RLC        from 'rlc-faucet-contract/build/contracts/RLC.json';

class Services extends React.Component
{
	constructor(props)
	{
		super(props);
		this.state = {
			emitter:    new EventEmitter(),
			provider:   new ethers.providers.Web3Provider(window.ethereum),
			config:     baseConfig,
			getNetwork: (chainId = this.state.chainId) => ({ chainId, ...this.state.config.networks[chainId] }),
		}
	}

	componentDidMount()
	{
		window.ethereum.enable()
		.then(() => {
			this.setState({ chainId: window.ethereum.networkVersion });
			this.start();
			window.ethereum.on('networkChanged',  () => this.state.emitter.emit('Notify', 'info', 'Please refresh the page.', 'Network changed'));
			window.ethereum.on('accountsChanged', this.start);
		});
	}
	componentWillUnmount()
	{
		this.stop();
	}


	start = async () => {
		if (!this.state.getNetwork().lottery)
		{
			this.setState({
				chainId:          window.ethereum.networkVersion,
				lottery:          null,
				token:            null,
				walletAddr:       null,
				ERC20Balance:     null,
				ERC721Balance:    {},
				ticketsByLottery: {},
			});

			this.state.emitter.emit('Notify', 'error', 'Please switch to kovan.', 'Lottery unavailable on this network');
		}
		else
		{
			const lotteryAddr      = this.state.getNetwork().lottery;
			const lottery          = new ethers.Contract(lotteryAddr,           LOTTERY.abi, this.state.provider.getSigner());
			const token            = new ethers.Contract(await lottery.token(), RLC.abi,     this.state.provider.getSigner());
			const walletAddr       = window.ethereum.selectedAddress;
			const ERC20Balance     = null;
			const ERC721Balance    = {};
			const ticketsByLottery = {};

			this.setState({
				chainId: window.ethereum.networkVersion,
				lottery,
				token,
				walletAddr,
				ERC20Balance,
				ERC721Balance,
				ticketsByLottery,
			});

			// Event subscribe
			this.state.lottery.addListener(this.state.lottery.filters.NewLottery(null), this.onNewLottery);
			this.state.token.addListener(this.state.token.filters.Transfer(null, this.state.walletAddress), this.onERC20Transfer);
			this.state.token.addListener(this.state.token.filters.Transfer(this.state.walletAddress, null), this.onERC20Transfer);
			this.state.lottery.addListener(this.state.lottery.filters.Transfer(this.state.walletAddress, null, null), this.onERC721Transfer);
			this.state.lottery.addListener(this.state.lottery.filters.Transfer(null, this.state.walletAddress, null), this.onERC721Transfer);
			// Notify - refresh
			this.onNewLottery();
			this.onERC20Transfer();
			this.onERC721Transfer();

			this.state.emitter.emit('Notify', 'success', 'Connection successfull');
		}
	}

	stop = async () => {
		this.state.lottery.removeListener(this.state.lottery.filters.NewLottery(null), this.onNewLottery);
		this.state.token.removeListener(this.state.token.filters.Transfer(null, this.state.walletAddress), this.onERC20Transfer);
		this.state.token.removeListener(this.state.token.filters.Transfer(this.state.walletAddress, null), this.onERC20Transfer);
		this.state.lottery.removeListener(this.state.lottery.filters.Transfer(this.state.walletAddress, null, null), this.onERC721Transfer);
		this.state.lottery.removeListener(this.state.lottery.filters.Transfer(null, this.state.walletAddress, null), this.onERC721Transfer);
	}

	onNewLottery = (lotteryid) => {
		this.state.emitter.emit('NewLottery', lotteryid)
	}

	onERC20Transfer = (from, to, value) => {
		this.state.token.balanceOf(this.state.walletAddr)
		.then(ERC20Balance => {
			this.setState({ ERC20Balance });
		});
	}

	onERC721Transfer = (from, to, tokenID) => {
		if (tokenID && from === this.state.walletAddress)
		{
			if (this.state.ERC721Balance[tokenID])
			{
				const lotteryID = this.state.ERC721Balance[tokenID].lotteryID;
				delete this.state.ERC721Balance[tokenID];
				this.state.ticketsByLottery[lotteryID] = Object.values(this.state.ERC721Balance).filter(e => e.lotteryID.toString() === lotteryID.toString()).length;
			}
		}
		else if (tokenID && to === this.state.walletAddress)
		{
			if (!this.state.ERC721Balance[tokenID])
			{
				this.state.lottery
				.viewTicket(tokenID)
				.then(ticketDetails => {
					const lotteryID = ticketDetails.lotteryID;
					this.state.ERC721Balance[tokenID] = ticketDetails;
					this.state.ticketsByLottery[lotteryID] = Object.values(this.state.ERC721Balance).filter(e => e.lotteryID.toString() === lotteryID.toString()).length;
				});
			}
		}
		else
		{
			this.state.lottery.balanceOf(this.state.walletAddr)
			.then(ERC20BalanceNFT => {
				Promise.all(
					[...Array(Number(ERC20BalanceNFT)).keys()]
					.map(index => this.state.lottery.tokenOfOwnerByIndex(this.state.walletAddr, index))
				)
				.then(tokenIDs => {
					tokenIDs.forEach(tokenID => {
						this.onERC721Transfer(null, this.state.walletAddress, tokenID);
					})
				})
			});
		}
	}

	render()
	{
		return (
			<Context.Provider value={this.state}>
				{ this.props.children }
			</Context.Provider>
		);
	};
}

export default Services;
