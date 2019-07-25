import React from "react";
import { MDBNavItem, MDBNavbar, MDBNavbarBrand, MDBNavbarNav } from 'mdbreact';

import { rlcFormat } from '../utils';

class Nav extends React.Component
{
	render()
	{
		return (
			<MDBNavbar color="special-color-dark" dark expand="md">
				<MDBNavbarBrand>
					The RLC lottery <span className="font-weight-lighter">- powered by the iExec Doracle solution</span>
				</MDBNavbarBrand>
				<MDBNavbarNav left>
				</MDBNavbarNav>
				<MDBNavbarNav right>
					<MDBNavItem text="white">
						{ this.props.context.walletBalance && `Balance: ${rlcFormat(this.props.context.walletBalance)}` }
					</MDBNavItem>
				</MDBNavbarNav>
			</MDBNavbar>
		);
	}
}

export default Nav;