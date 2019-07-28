import React from "react";
import { MDBCard, MDBFormInline, MDBIcon, MDBInput } from 'mdbreact';

import LotteryView from './LotteryView';
import LotteryAdd  from './LotteryAdd';

class LotteryList extends React.Component
{
	state = {
		count: 0
	};

	componentDidMount()
	{
		this.subscription = this.props.context.emitter.addListener('NewLottery', this.onNewLottery);
	}

	componentWillUnmount()
	{
		this.subscription.remove();
	}

	onNewLottery = (lotteryid) => {
		if (lotteryid)
		{
			this.setState({ count: lotteryid.toNumber() + 1 });
		}
		else if (this.props.context.connected)
		{
			this.props.context.contracts.lottery.countLottery().then(count => this.setState({ count: count.toNumber() }));
		}
		else
		{
			this.setState({ count: 0 });
		}
	}

	render()
	{
						// <MDBCardTitle></MDBCardTitle>
		return (
			<>
				<MDBCard className="text-center m-2">
						<MDBFormInline className="justify-content-center">
							<MDBInput label="Hide finished" type="checkbox" id="hideFinished" onChange={ event => this.props.context.setFilter('hideFinished', event.target.checked) }/>
							<MDBInput label="My tickets"    type="checkbox" id="myTickets"    onChange={ event => this.props.context.setFilter('myTickets',    event.target.checked) }/>
							<MDBInput label="On sale"       type="checkbox" id="buyTickets"   onChange={ event => this.props.context.setFilter('buyTickets',   event.target.checked) }/>
							<LotteryAdd context={this.props.context} size="sm">
								New <MDBIcon icon="plus" className="ml-1"/>
							</LotteryAdd>
						</MDBFormInline>
				</MDBCard>
				{
					[ ...Array(this.state.count).keys() ]
					.reverse()
					.map(i => <LotteryView key={i} id={i} context={this.props.context}/> )
				}
			</>
		);
	}
}

export default LotteryList;
