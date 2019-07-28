const rlcFormat = (value) => {
	return value ? value < 10**6
	? `${value.toString()} nRLC`
	: `${value.div(10**9).toString()} RLC`
	: "---";
};

const strPadLeft = (string,pad,length) => (new Array(length+1).join(pad)+string).slice(-length);

const durationFormat = (value) => {
	const seconds = Math.floor(value /     1000 % 60);
	const minutes = Math.floor(value /    60000 % 60);
	const   hours = Math.floor(value /  3600000 % 24);
	const    days = Math.floor(value / 86400000     );

	if      (   days > 0) return `${days}d ${strPadLeft(hours,'0',2)}h ${strPadLeft(minutes,'0',2)}m ${strPadLeft(seconds,'0',2)}s`;
	else if (  hours > 0) return `${hours}h ${strPadLeft(minutes,'0',2)}m ${strPadLeft(seconds,'0',2)}s`;
	else if (minutes > 0) return `${minutes}m ${strPadLeft(seconds,'0',2)}s`;
	else                  return `${seconds}s`;
}

export { rlcFormat, durationFormat, strPadLeft};
