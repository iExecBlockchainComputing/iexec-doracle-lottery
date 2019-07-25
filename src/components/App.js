import React from "react";

import Context       from '../context';

import Services      from './Services';
import Notifications from './Notifications';
import Nav           from './Nav';
import LotteryList   from './LotteryList';


class App extends React.Component
{
	render()
	{
		return (
			<Services>
				<Context.Consumer>
					{
						context =>
						<>
							<Notifications context={context}/>
							<Nav           context={context}/>
							<LotteryList   context={context}/>
						</>
					}
				</Context.Consumer>
			</Services>
		);
	}
}

export default App;
