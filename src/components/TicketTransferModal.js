import React from "react";
import { MDBBtn, MDBCard, MDBCardHeader, MDBCardBody, MDBIcon, MDBInputGroup, MDBModal } from 'mdbreact';

import { ethers } from 'ethers';

class TicketTransferModal extends React.Component
{
	state = { modal: false };

	toggle = () => {
		this.setState({
			modal: !this.state.modal
		});
	}

	transfer = (event) => {
		try
		{
			event.preventDefault();
			const from = ethers.utils.getAddress(event.target[0].value);
			const to   = ethers.utils.getAddress(event.target[1].value);

			this.props.context.contracts.lottery.transferFrom(from, to, this.props.id)
			.then(txPromise => {
				txPromise
				.wait()
				.then(tx => {
					this.props.context.emitter.emit('Notify', 'info', 'Ticket transfered');
				})
				.catch(console.error);
			})
			.catch(console.error);

			this.toggle();
		} catch (e) {
			this.props.context.emitter.emit('Notify', 'error', 'See log for more info', 'Error during transfer');
			console.error(e);
		}
	}

	render() {
		return (
			<>
				<MDBModal isOpen={this.state.modal} toggle={this.toggle} size="fluid" centered>
					<MDBCard narrow>
						<MDBCardHeader className="blue-gradient text-center">
							<div className="white-text mx-3">
								Ticket transfer #{this.props.id.toString()}
							</div>
						</MDBCardHeader>
						<MDBCardBody cascade>
							<form onSubmit={this.transfer} className="d-flex justify-content-between align-items-center">
								<MDBInputGroup
									material
									name="from"
									hint="From"
									disabled
									value={this.props.context.getTicket(this.props.id).owner}
								/>
								<MDBIcon icon="long-arrow-alt-right" className="mx-2"/>
								<MDBInputGroup
									material
									name="to"
									hint="To"
								/>
								<MDBBtn gradient="blue" className="btn-sm col-2" type="submit">
									Send <MDBIcon icon="paper-plane" className="ml-2"/>
								</MDBBtn>
							</form>
						</MDBCardBody>
					</MDBCard>
				</MDBModal>
				<MDBBtn {...this.props} onClick={this.toggle} disabled={this.props.details.metadata.status === 2 || this.props.context.getTicket(this.props.id).owner !== this.props.context.getWallet()}>Transfer</MDBBtn>
			</>
		);
	}
}

export default TicketTransferModal;
