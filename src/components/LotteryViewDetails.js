import React from "react";
import { MDBBtn, MDBCollapse } from 'mdbreact';

import { rlcFormat } from '../utils';

class LotteryViewDetails extends React.Component
{
	state = {
		collapseID: ''
	};

	toggle = collapseID => () => {
		this.setState(prevState => ({
			collapseID: prevState.collapseID !== collapseID ? collapseID : ""
		}));
	}

	render() {
		return (
			<div className="details z-depth-1">
				<MDBCollapse id="body" isOpen={this.state.collapseID}>
					<div className="details-content">
						<p>
							Pot value: { rlcFormat(this.props.parent.details.potValue) }
						</p>
						<p>
							Deadline: { (new Date(Number(this.props.parent.details.crowdsaleDeadline) * 1000)).toISOString() }
						</p>
					</div>
				</MDBCollapse>
				<MDBBtn color="white" className="btn-sm toggle z-depth-1" onClick={this.toggle("body")}>details</MDBBtn>
			</div>
		);
	}

}

export default LotteryViewDetails;
