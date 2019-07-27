import React from "react";
import { MDBBadge, MDBBtn, MDBIcon, MDBTable, MDBTableBody, MDBTooltip } from 'mdbreact';

import { ethers } from 'ethers';
import iexec from 'iexec';

import LotteryViewDetails from './LotteryViewDetails';
import { rlcFormat, durationFormat } from '../utils';

// 0 → status;
// 1 → oracleCall;
// 2 → ticketPrice;
// 3 → ticketCount;
// 4 → ticketMaxCount;
// 5 → potValue;
// 6 → crowdsaleDeadline;

class LotteryView extends React.Component
{
	state = {}

	componentDidMount()
	{
		this.fetch().then(() => {
			this.timer();
			this.setState({ clock: setInterval(this.timer, 1000) });
		});
		this.subscriptionNewParticipant = this.props.context.emitter.addListener('NewParticipant', this.onNewParticipant);
		this.subscriptionNewRoll        = this.props.context.emitter.addListener('NewRoll',        this.onNewRoll       );
		this.subscriptionReward         = this.props.context.emitter.addListener('Reward',         this.onReward        );
		this.subscriptionFaillure       = this.props.context.emitter.addListener('Faillure',       this.onFaillure      );
		this.subscriptionClaim          = this.props.context.emitter.addListener('Claim',          this.onClaim         );
	}

	componentWillUnmount()
	{
		clearInterval(this.state.clock);
		this.subscriptionNewParticipant.remove();
		this.subscriptionNewRoll.remove();
		this.subscriptionReward.remove();
		this.subscriptionFaillure.remove();
		this.subscriptionClaim.remove();
	}

	fetch = () => new Promise((resolve, reject) => {
		this.props.context.contracts.lottery.viewLottery(this.props.id).then(metadata => {
			this.setState({ metadata });
			resolve();
		});
	})

	timer = () => {
		this.setState({
			remainingTime:    new Date(this.state.metadata.crowdsaleDeadline.toNumber() * 1000 - Date.now()),
			remainingTickets: this.state.metadata.ticketMaxCount.sub(this.state.metadata.ticketCount),
			rolling:          this.state.metadata.oracleCall !== ethers.constants.HashZero,
		});
	}

	onNewParticipant = (lotteryid, ticketid) => {
		if (lotteryid.eq(this.props.id))
		{
			this.fetch();
		}
	}

	onNewRoll = (lotteryid, taskid) => {
		if (lotteryid.eq(this.props.id))
		{
			this.fetch();
		}
	}

	onReward = (lotteryid, winner, value) => {
		if (lotteryid.eq(this.props.id))
		{
		// if (winner === this.props.context.walletAddr)
		// {
		// 	this.props.context.emitter.emit('Notify', 'success', `You won ${rlcFormat(value)}`, `You are a winner`);
		// }
		// else
		// {
		// 	this.props.context.emitter.emit('Notify', 'error', `${winner} won ${rlcFormat(value)}`, `Better luck next time`);
		// }
			this.fetch();
		}
	}

	onFaillure = (lotteryid) => {
		if (lotteryid.eq(this.props.id))
		{
			this.fetch();
		}
	}

	onClaim = (lotteryid) => {
		if (lotteryid.eq(this.props.id))
		{
			this.fetch();
		}
	}

	buyTicket = (lotteryID) => () => {
		if (this.props.context.balance.lt(this.state.metadata[2]))
		{
			this.props.context.emitter.emit('Notify', 'error', `You don't have enough tokens to buy this ticket`);
		}
		else
		{
			this.props.context.contracts.token.approveAndCall(this.props.context.contracts.lottery.address, this.state.metadata[2], ethers.utils.defaultAbiCoder.encode(["uint256"], [ lotteryID ]))
			.then(txPromise => {
				txPromise
				.wait()
				.then(tx => {
					this.props.context.emitter.emit('Notify', 'info', 'Ticket bought');
				})
				.catch(console.error);
			})
			.catch(console.error);
		}
	}

	getAppOrder = () => {
		return new Promise((resolve, reject) => {
			const network = this.props.context.getNetwork();
			iexec.orderbook.fetchAppOrderbook(network.chainId, network.app)
			.then(orderbook => {
				resolve(
					orderbook
					.appOrders
					.filter(e => e.status === 'open')
					// .filter(e => e.order.tag == )
					.sort((e1, e2) => e1.order.appprice - e2.order.appprice)[0]
					.order
				)
			})
			.catch(reject);
		});
	}

	getDatasetOrder = () => {
		return new Promise((resolve, reject) => {
			const network = this.props.context.getNetwork();
			if (network.dataset)
			{
				iexec.orderbook.fetchDatasetOrderbook(network.chainId, network.dataset)
				.then(orderbook => {
					resolve(
						orderbook
						.datasetOrders
						.filter(e => e.status === 'open')
						// .filter(e => e.order.tag == )
						.sort((e1, e2) => e1.order.datasetprice - e2.order.datasetprice)[0]
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

	getWorkerpoolOrder = () => {
		return new Promise((resolve, reject) => {
			const network = this.props.context.getNetwork();
			Promise.all(this.props.context.config.match.categories.map(cat => iexec.orderbook.fetchWorkerpoolOrderbook(network.chainId, cat.toString(), {})))
			.then(orderbooks => {
				resolve(
					[]
					.concat(...orderbooks.map(e => e.workerpoolOrders))
					.filter(e => e.status === 'open')
					.filter(e => !network.workerpool || e.order.workerpool === network.workerpool)
					// .filter(e => e.order.tag == )
					.sort((e1, e2) => e1.order.workerpoolprice - e2.order.workerpoolprice)[0]
					.order
				);
			})
			.catch(reject);
		});
	}

	rollDice = (lotteryID) => () =>
	{
		// Promise.all([
		// 	this.getAppOrder(),
		// 	this.getDatasetOrder(),
		// 	this.getWorkerpoolOrder(),
		// ])
		// .then(orders => {
		// 	this.props.context.lottery
		// 	.roll(lotteryID, ...orders)
		// 	.then(txPromise => {
		// 		txPromise
		// 		.wait()
		// 		.then(tx => {
		// 			this.props.context.emitter.emit('Notify', 'warning', 'Dices are rolling');
		// 		})
		// 		.catch(console.error);
		// 	})
		// 	.catch(console.error);
		// })
		// .catch(console.error);
	}

	claim = (lotteryID) => () =>
	{
		// this.props.context.lottery
		// .claim(lotteryID)
		// .then(txPromise => {
		// 	txPromise
		// 	.wait()
		// 	.then(tx => {
		// 		this.props.context.emitter.emit('Notify', 'warning', 'Claim successfull');
		// 	})
		// 	.catch(console.error);
		// })
		// .catch(console.error);
	}

	render()
	{
		if (!this.state.metadata) return null;

		let code, descr, color;
		if      (this.state.metadata.status === 1 && this.state.remainingTime > 0 && this.state.remainingTickets.gt(0)    ) { code = +1; descr = "Active";   color = "success"; }
		else if (this.state.metadata.status === 1 && this.state.remainingTime > 0 && this.state.remainingTickets.eq(0)    ) { code = +2; descr = "Active";   color = "success"; }
		else if (this.state.metadata.status === 1 && this.state.remainingTime < 0 && this.state.metadata.ticketCount.eq(0)) { return null;                                      } // Hidden
		else if (this.state.metadata.status === 1 && this.state.remainingTime < 0 && !this.state.rolling                  ) { code = +3; descr = "Ready";    color = "info";    }
		else if (this.state.metadata.status === 1 && this.state.remainingTime < 0 &&  this.state.rolling                  ) { code = +4; descr = "Rolling";  color = "warning"; }
		else if (this.state.metadata.status === 2                                                                         ) { code = +5; descr = "Finished"; color = "light";   }
		else                                                                                                                { code = -1; descr = "Error";    color = "danger";  }

		const owned = Object.values(this.props.context.tickets).filter(e => e.lotteryID.eq(this.props.id)).length;
		return (
			<div className="lottery">
				<div className="header d-flex z-depth-2">
				{ owned > 0 && <MDBBadge pill color="warning">{ owned }/{ this.state.metadata.ticketCount.toString() }</MDBBadge> }
					<MDBBtn color={color} disabled className="btn-sm col-2 z-depth-0">{descr}</MDBBtn>
					<div className="mx-auto">
						<MDBTable small borderless className="mb-0">
							<MDBTableBody>
								<tr>
									<td>{ `${rlcFormat(this.state.metadata.ticketPrice)}/ticket` }</td>
									<td>-</td>
									<td>{ `${this.state.metadata.ticketCount.toString()}/${this.state.metadata.ticketMaxCount.toString()} sold` }</td>
								</tr>
							</MDBTableBody>
						</MDBTable>
					</div>
					{
						code === 1 &&
						<MDBTooltip placement="top">
							<MDBBtn gradient="blue" className="btn-sm col-2 z-depth-0" onClick={this.buyTicket(this.props.id)}>
								Buy ticket
								<MDBIcon icon="ticket-alt" className="ml-2"/>
							</MDBBtn>
							<div>
								{ durationFormat(Number(this.state.remainingTime)) } remaining
							</div>
						</MDBTooltip>
					}
					{
						code === 3 &&
						<MDBBtn gradient="peach" className="btn-sm col-2 z-depth-0" onClick={this.rollDice(this.props.id)} >
							Roll dice
							<MDBIcon icon="dice" className="ml-2"/>
						</MDBBtn>
					}
					{
						code === 4 &&
						<MDBBtn gradient="peach" className="btn-sm col-2 z-depth-0" onClick={this.claim(this.props.id)}    >
							Claim
							<MDBIcon icon="exclamation-triangle" className="ml-2"/>
						</MDBBtn>
					}
					{ ![1,3,4].includes(code) && <MDBBtn className="btn-sm col-2 invisible"/> }
				</div>
				<LotteryViewDetails id={this.props.id} details={this.state}/>
			</div>
		);
	}
}

export default LotteryView;
