import React from "react";
import { MDBBadge, MDBBtn, MDBIcon, MDBTable, MDBTableBody } from 'mdbreact';

import { ethers } from 'ethers';
import iexec from 'iexec';

import LotteryViewDetails from './LotteryViewDetails';
import { rlcFormat } from '../utils';

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
		this.refresh().then(() => {
			this.timer();
			this.setState({ clock: setInterval(this.timer, 1000) });
		});

		this.props.context.lottery.addListener(this.props.context.lottery.filters.NewParticipant(this.props.id, null      ), this.onNewParticipant);
		this.props.context.lottery.addListener(this.props.context.lottery.filters.NewRoll       (this.props.id, null      ), this.onNewRoll       );
		this.props.context.lottery.addListener(this.props.context.lottery.filters.Reward        (this.props.id, null, null), this.onReward        );
		this.props.context.lottery.addListener(this.props.context.lottery.filters.Faillure      (this.props.id            ), this.onFaillure      );
		this.props.context.lottery.addListener(this.props.context.lottery.filters.Claim         (this.props.id            ), this.onClaim         );
	}

	componentWillUnmount()
	{
		clearInterval(this.state.clock);
		this.props.context.lottery.removeListener(this.props.context.lottery.filters.NewParticipant(this.props.id, null      ), this.onNewParticipant);
		this.props.context.lottery.removeListener(this.props.context.lottery.filters.NewRoll       (this.props.id, null      ), this.onNewRoll       );
		this.props.context.lottery.removeListener(this.props.context.lottery.filters.Reward        (this.props.id, null, null), this.onReward        );
		this.props.context.lottery.removeListener(this.props.context.lottery.filters.Faillure      (this.props.id            ), this.onFaillure      );
		this.props.context.lottery.removeListener(this.props.context.lottery.filters.Claim         (this.props.id            ), this.onClaim         );
	}

	refresh = () =>
	{
		return new Promise((resolve, reject) => {
			this.props.context.lottery.viewLottery(this.props.id)
			.then(details => {
				this.setState({ details: details });
				resolve(null);
			})
			.catch(reject);
		});
	}

	onNewParticipant = (lotteryid, ticketid) => {
		this.refresh();
	}

	onNewRoll = (lotteryid, taskid) => {
		this.refresh();
	}

	onReward = (lotteryid, winner, value) => {
		if (winner === this.props.context.walletAddr)
		{
			this.props.context.emitter.emit('Notify', 'success', `You won ${rlcFormat(value)}`, `You are a winner`);
		}
		else
		{
			this.props.context.emitter.emit('Notify', 'error', `${winner} won ${rlcFormat(value)}`, `Better luck next time`);
		}
		this.refresh();
	}

	onFaillure = (lotteryid) => {
		this.refresh();
	}

	onClaim = (lotteryid) => {
		this.refresh();
	}

	buyTicket = (lotteryID) => () => {
		if (Number(this.props.context.walletBalance) < Number(this.state.details[2]))
		{
			console.error("Not enough tokens!");
		}
		else
		{
			this.props.context.token.approveAndCall(this.props.context.lottery.address, this.state.details[2], ethers.utils.defaultAbiCoder.encode(["uint256"], [ lotteryID ]))
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
			iexec.orderbook.fetchAppOrderbook(this.props.context.chainId, this.props.context.config.match.app)
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
			if (this.props.context.config.match.dataset)
			{
				iexec.orderbook.fetchDatasetOrderbook(this.props.context.chainId, this.props.context.config.match.dataset)
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
			Promise.all(this.props.context.config.match.categories.map(cat => iexec.orderbook.fetchWorkerpoolOrderbook(this.props.context.chainId, cat.toString(), {})))
			.then(orderbooks => {
				resolve(
					[]
					.concat(...orderbooks.map(e => e.workerpoolOrders))
					.filter(e => e.status === 'open')
					.filter(e => !this.props.context.config.match.workerpool || e.order.workerpool === this.props.context.config.match.workerpool)
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
		Promise.all([
			this.getAppOrder(),
			this.getDatasetOrder(),
			this.getWorkerpoolOrder(),
		])
		.then(orders => {
			this.props.context.lottery
			.roll(lotteryID, ...orders)
			.then(txPromise => {
				txPromise
				.wait()
				.then(tx => {
					this.props.context.emitter.emit('Notify', 'warning', 'Dices are rolling');
				})
				.catch(console.error);
			})
			.catch(console.error);
		})
		.catch(console.error);
	}

	claim = (lotteryID) => () =>
	{
		this.props.context.lottery
		.claim(lotteryID)
		.then(txPromise => {
			txPromise
			.wait()
			.then(tx => {
				this.props.context.emitter.emit('Notify', 'warning', 'Claim successfull');
			})
			.catch(console.error);
		})
		.catch(console.error);
	}

	timer = () => {
		this.setState({
			remainingTime:    new Date(Number(this.state.details.crowdsaleDeadline) * 1000 - Date.now()),
			remainingTickets: Number(this.state.details.ticketMaxCount - this.state.details.ticketCount),
			rolling:          this.state.details.oracleCall !== ethers.constants.HashZero,
		});
	}

	render()
	{
		if (!this.state.details) return null;

		let code, descr, color;
		if      (this.state.details.status === 1 && this.state.remainingTime > 0 && this.state.remainingTickets >  0) { code = +1; descr = "Active";   color = "success"; }
		else if (this.state.details.status === 1 && this.state.remainingTime > 0 && this.state.remainingTickets <= 0) { code = +2; descr = "Active";   color = "success"; }
		else if (this.state.details.status === 1 && this.state.remainingTime < 0 && !this.state.rolling             ) { code = +3; descr = "Ready";    color = "info";    }
		else if (this.state.details.status === 1 && this.state.remainingTime < 0 &&  this.state.rolling             ) { code = +4; descr = "Rolling";  color = "warning"; }
		else if (this.state.details.status === 2                                                                    ) { code = +5; descr = "Finished"; color = "light";   }
		else                                                                                                          { code = -1; descr = "Error";    color = "danger";  }

		return (
			<div className="lottery">
				<div className="header d-flex z-depth-2">
					{ this.props.context.ticketsByLottery[this.props.id] > 0 && <MDBBadge pill color="warning">{ this.props.context.ticketsByLottery[this.props.id] }</MDBBadge> }
					<MDBBtn color={color} disabled className="btn-sm col-2">{descr}</MDBBtn>
					<div className="mx-auto">
						<MDBTable small borderless className="mb-0">
							<MDBTableBody>
								<tr>
									<td>{ `${rlcFormat(this.state.details.ticketPrice)}/ticket` }</td>
									<td>-</td>
									<td>{ `${this.state.details.ticketCount.toString()}/${this.state.details.ticketMaxCount.toString()} sold` }</td>
								</tr>
							</MDBTableBody>
						</MDBTable>
					</div>
					{ code === 1 && <MDBBtn gradient="blue"  className="btn-sm col-2" onClick={this.buyTicket(this.props.id)}>Buy ticket<MDBIcon icon="ticket-alt"           className="ml-2"/></MDBBtn> }
					{ code === 3 && <MDBBtn gradient="peach" className="btn-sm col-2" onClick={this.rollDice(this.props.id)} >Roll dice <MDBIcon icon="dice"                 className="ml-2"/></MDBBtn> }
					{ code === 4 && <MDBBtn gradient="peach" className="btn-sm col-2" onClick={this.claim(this.props.id)}    >Claim     <MDBIcon icon="exclamation-triangle" className="ml-2"/></MDBBtn> }
					{ ![1,3,4].includes(code) && <div className="col-2"></div> }
				</div>
				<LotteryViewDetails id={this.props.id} details={this.state.details}/>
			</div>
		);
	}
}

export default LotteryView;
