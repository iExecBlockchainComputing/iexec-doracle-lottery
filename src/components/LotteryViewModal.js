import React from "react";
import { MDBBtn, MDBCard, MDBCardHeader, MDBCardBody, MDBDataTable, MDBIcon, MDBModal } from 'mdbreact';

import { rlcFormat, strPadLeft } from '../utils';

class LotteryViewModal extends React.Component
{
	state = { modal: false };

	componentDidMount()
	{
		this.subscriptionTicketFetched = this.props.context.emitter.addListener('TicketFetched', this.onTicketFetched);
	}

	componentWillUnmount()
	{
		this.subscriptionTicketFetched.remove();
	}

	toggle = () => {
		this.setState({
			modal: !this.state.modal
		});
	}

	onTicketFetched = (ticketid, owner, lotteryid) => {
		if (lotteryid.eq(this.props.id))
		{
			this.setState({
				data:
				{
					columns: [
						{ 'label': 'Token ID', 'field': 'tokenid' },
						{ 'label': 'Owner',    'field': 'owner'   },
					],
					rows: this.props.details.ticketIDs
						.map(id => ({ id: id, ticket: this.props.context.getTicket(id) }))
						.filter(({ticket}) => ticket)
						.map(({id, ticket}) => ({
							tokenid: <a target="_blank" className="text-center" href={`${this.props.context.getNetwork().etherscan}/token/${this.props.context.contracts.lottery.address}?a=${id}`}                                     rel="noopener noreferrer">{ strPadLeft(id.toString(), '0', 77) }</a>,
							owner:   <a target="_blank" className="text-center" href={`${this.props.context.getNetwork().etherscan}/token/${this.props.context.contracts.lottery.address}?a=${this.props.context.getTicket(id).owner}`} rel="noopener noreferrer">{ ticket.owner }</a>,
						}))
				}
			});
		}
	}

	render() {
		return (
			<>
				<MDBModal isOpen={this.state.modal} toggle={this.toggle} size="lg" centered>
					<MDBCard narrow>
						<MDBCardHeader className="blue-gradient d-flex justify-content-between align-items-center">
							<div>
							{
								<MDBBtn outline rounded size="sm" color="white" className="px-2">
									{rlcFormat(this.props.details.metadata.potValue)} <MDBIcon icon="coins" className="ml-2"/>
								</MDBBtn>
							}
							</div>
							<div className="white-text mx-3">
								Lottery #{this.props.id}
							</div>
							<div>
							{
								this.props.details.rolling &&
								<MDBBtn outline rounded size="sm" color="white" className="px-2" target="_blank" href={`${this.props.context.getNetwork().explorer}/task/${this.props.details.metadata.oracleCall}`}>
									iExec task <MDBIcon icon="desktop" className="ml-2"/>
								</MDBBtn>
							}
							</div>
						</MDBCardHeader>
						<MDBCardBody cascade>
							<MDBDataTable
								data={this.state.data}
								small
								responsive
								entriesLabel=""
								exportToCSV
								// paging={false}
								searching={false}
								sortable={false}
							/>
						</MDBCardBody>
					</MDBCard>
				</MDBModal>
				<MDBBtn color="white" className="btn-sm toggle z-depth-1" onClick={this.toggle}>details</MDBBtn>
			</>
		);
	}
}

export default LotteryViewModal;
