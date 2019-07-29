import React from "react";
import { MDBNavItem, MDBNavbar, MDBNavbarBrand, MDBNavbarNav } from 'mdbreact';

import { rlcFormat } from '../utils';

class Nav extends React.Component
{
	render()
	{
		return (
			<MDBNavbar color="special-color-dark" dark>
				<MDBNavbarBrand>
					The RLC lottery <span className="font-weight-lighter">- powered by iExec</span>
				</MDBNavbarBrand>
				<MDBNavbarNav left>
				</MDBNavbarNav>
				<MDBNavbarNav right>
					<MDBNavItem text="white">
						Balance: { rlcFormat(this.props.context.getBalance()) }
					</MDBNavItem>
				</MDBNavbarNav>
			</MDBNavbar>
		);
	}
}

export default Nav;
