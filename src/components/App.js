import React from "react";

import BlockchainProvider, { withBlockchain } from '../store/BlockchainProvider';

import Notifications from './Notifications';
import Nav           from './Nav';
import LotteryList   from './LotteryList';

class App extends React.Component
{
	render()
	{
		const WrappedNotifications = withBlockchain(Notifications);
		const WrappedNav           = withBlockchain(Nav);
		const WrappedLotteryList   = withBlockchain(LotteryList);

		return (
			<BlockchainProvider>
				<WrappedNotifications/>
				<WrappedNav/>
				<WrappedLotteryList/>
			</BlockchainProvider>
		);
	}
}

export default App;
