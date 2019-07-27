import React from "react";
import { MDBBtn, MDBModal, MDBModalHeader, MDBModalBody, MDBInputGroup } from 'mdbreact';

class LotteryAdd extends React.Component
{
	state = {
		modal: false
	};

	toggle = () => {
		this.setState({
			modal: !this.state.modal
		});
	}

	create = (event) => {
		event.preventDefault();
		const ticketCount = Number(event.target[0].value);
		const ticketPrice = Number(event.target[1].value) * 10 ** Number(event.target[2].value);
		const duration    = Number(event.target[3].value) * Number(event.target[4].value);
		if (ticketCount <= 0) { console.error("ticketCount must be > 0"  ); return; }
		if (ticketPrice <  0) { console.error("ticketsPrice must be >= 0"); return; }
		if (duration    <= 0) { console.error("duration must be > 0"     ); return; }

		this.props.context.contracts.lottery.createLottery(ticketPrice, ticketCount, duration)
		.then(txPromise => {
			txPromise
			.wait()
			.then(tx => {
				this.props.context.emitter.emit('Notify', 'info', 'Lottery created');
			})
			.catch(console.error);
		})
		.catch(console.error);

		this.toggle();
	}

	render()
	{
		return (
			<>
				<MDBBtn gradient="blue" className="btn-sm mx-auto" onClick={this.toggle}>{this.props.text}</MDBBtn>
				<MDBModal isOpen={this.state.modal} toggle={this.toggle}>
					<MDBModalHeader toggle={this.toggle}>Create new lottery</MDBModalHeader>
					<MDBModalBody>
						<form onSubmit={this.create}>
							<MDBInputGroup
								material
								name="count"
								containerClassName="mb-3 mt-0"
								hint="Number of ticket"
								type='number'
								append="tickets"
							/>
							<MDBInputGroup
								material
								name="price"
								containerClassName="mb-3 mt-0"
								hint="Ticket price"
								append={
									<select>
										<option value="9">RLC</option>
										<option value="0">nRLC</option>
									</select>
								}
							/>
							<MDBInputGroup
								material
								name="duration"
								containerClassName="mb-3 mt-0"
								hint="Duration"
								append={
									<select>
										<option value="60">minute(s)</option>
										<option value="3600">hour(s)</option>
										<option value="86400">day(s)</option>
									</select>
								}
							/>
							<div className="text-center">
								<MDBBtn gradient="blue" className="btn-sm" type="submit">Create</MDBBtn>
							</div>
						</form>
					</MDBModalBody>
				</MDBModal>
			</>
		);
	}
}

export default LotteryAdd;
