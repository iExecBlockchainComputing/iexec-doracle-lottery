const rlcFormat = (value) => {
	return value < 10**6
	? `${value.toString()} nRLC`
	: `${value.div(10**9).toString()} RLC`
};

export { rlcFormat };
