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
		this.subscription = this.props.context.emitter.addListener('NewLottery', this.refresh);
	}

	componentWillUnmount()
	{
		this.subscription.remove();
	}

	refresh = (lotteryid) => {
		this.props.context.lottery.countLottery()
		.then(count => {
			this.setState({ count: count });
		})
		.catch(console.error);
	}

	render()
	{
		return (
			<>
			{
				[ ...Array(Number(this.state.count)).keys() ]
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
