import React from "react";
import { MDBIcon, MDBRow } from 'mdbreact';

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
		return (
			<>
			{
				[ ...Array(this.state.count).keys() ]
				.reverse()
				.map(i => <LotteryView key={i} id={i} context={this.props.context}/> )
			}
			<MDBRow center>
				<LotteryAdd context={this.props.context} text={<MDBIcon icon="plus" className="ml-1"/>}/>
			</MDBRow>
			</>
		);
	}
}

export default LotteryList;
