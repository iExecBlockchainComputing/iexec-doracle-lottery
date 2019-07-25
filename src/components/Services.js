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
			config:           baseConfig,
			emitter:          new EventEmitter(),
			provider:         null,
			walletAddr:       null,
			walletBalance:    null,
			walletNFTBalance: {},
			ticketsByLottery: {},
			chainId:          null,
			lottery:          null,
			token:            null,
		}
	}

	async componentDidMount()
	{
		await window.ethereum.enable();

		const provider      = new ethers.providers.Web3Provider(window.web3.currentProvider);
		const walletAddr    = await provider.getSigner().getAddress();
		const walletBalance = null;
		const chainId       = (await provider.ready).chainId;
		const lottery       = new ethers.Contract(this.state.config.lotteryAddr[chainId], LOTTERY.abi, provider.getSigner());
		const token         = new ethers.Contract(await lottery.token(),                  RLC.abi,     provider.getSigner());
		// Assert config.lotteryAddr[chainId] !== undefined

		this.setState({
			provider,
			walletAddr,
			walletBalance,
			chainId,
			lottery,
			token,
		});

		// Event subscribe
		this.state.lottery.addListener(this.state.lottery.filters.NewLottery(null), this.onNewLottery);
		this.state.token.addListener(this.state.token.filters.Transfer(null, this.state.walletAddress), this.onTokenTransfer);
		this.state.token.addListener(this.state.token.filters.Transfer(this.state.walletAddress, null), this.onTokenTransfer);
		this.state.lottery.addListener(this.state.lottery.filters.Transfer(this.state.walletAddress, null, null), this.onNFTTransfer);
		this.state.lottery.addListener(this.state.lottery.filters.Transfer(null, this.state.walletAddress, null), this.onNFTTransfer);
		// Notify - refresh
		this.state.emitter.emit('Notify', 'success', 'connection to the blockchain successfull');
		this.onNewLottery();
		this.onTokenTransfer();
		this.onNFTTransfer();
	}

	async componentWillUnmount()
	{
		this.state.lottery.removeListener(this.state.lottery.filters.NewLottery(null), this.onNewLottery);
		this.state.token.removeListener(this.state.token.filters.Transfer(null, this.state.walletAddress), this.onTokenTransfer);
		this.state.token.removeListener(this.state.token.filters.Transfer(this.state.walletAddress, null), this.onTokenTransfer);
		this.state.lottery.removeListener(this.state.lottery.filters.Transfer(this.state.walletAddress, null, null), this.onNFTTransfer);
		this.state.lottery.removeListener(this.state.lottery.filters.Transfer(null, this.state.walletAddress, null), this.onNFTTransfer);
	}

	onNewLottery = (lotteryid) => {
		this.state.emitter.emit('NewLottery', lotteryid)
	}

	onTokenTransfer = (from, to, value) => {
		this.state.token.balanceOf(this.state.walletAddr)
		.then(walletBalance => {
			this.setState({ walletBalance });
		});
	}

	onNFTTransfer = (from, to, tokenID) => {
		if (tokenID && from === this.state.walletAddress)
		{
			--this.state.ticketsByLottery[this.state.walletNFTBalance[tokenID].lotteryID];
			delete this.state.walletNFTBalance[tokenID];
		}
		else if (tokenID && to === this.state.walletAddress)
		{
			this.state.lottery
			.viewTicket(tokenID)
			.then(ticketDetails => {
				this.state.ticketsByLottery[ticketDetails.lotteryID] = (this.state.ticketsByLottery[ticketDetails.lotteryID] || 0) + 1;
				this.state.walletNFTBalance[tokenID] = ticketDetails;
			});
		}
		else
		{
			this.state.lottery.balanceOf(this.state.walletAddr)
			.then(walletBalanceNFT => {
				Promise.all(
					[...Array(Number(walletBalanceNFT)).keys()]
					.map(index => this.state.lottery.tokenOfOwnerByIndex(this.state.walletAddr, index))
				)
				.then(tokenIDs => {
					tokenIDs.forEach(tokenID => {
						this.onNFTTransfer(null, this.state.walletAddress, tokenID);
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
