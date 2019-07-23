pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

import "iexec-doracle-base/contracts/IexecDoracle.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";


contract Lottery is IexecDoracle, ERC721Full
{
	using SafeMath for uint256;

	bytes32 public constant TAG    = 0x0000000000000000000000000000000000000000000000000000000000000000; // NO TEE
	uint256 public constant TRUST  = 0; // No replication
	string  public constant PARAMS = "";

	IERC20 public token;

	enum LotteryStatusEnum
	{
		NULL,
		OPEN,
		ROLLING,
		FINISHED
	}
	struct LotteryMetadata
	{
		LotteryStatusEnum status;
		bytes32 oracleCall;
		uint256 ticketPrice;
		uint256 ticketCount;
		uint256 ticketMaxCount;
		uint256 potValue;
		uint256 registrationDeadline;
	}

	struct TicketMetadata
	{
		uint256 lotteryID;
		uint256 ticketNumber;
	}

	LotteryMetadata[]                  public lotteryMetadata;
	mapping(uint256 => TicketMetadata) public ticketMetadata;
	mapping(bytes32 => uint256       ) public oracleCallToLottery;

	event NewLottery    (uint256 indexed lotteryid);
	event NewParticipant(uint256 indexed lotteryid, uint256 ticketid);
	event NewRoll       (uint256 indexed lotteryid, bytes32 taskid);
	event Reward        (uint256 indexed lotteryid, address winner, uint256 value);
	event Claim         (uint256 indexed lotteryid);

	constructor(
		address _iexecHubAddr,
		address _app,
		address _dataset,
		address _workerpool)
	public IexecDoracle(_iexecHubAddr) ERC721Full("Lottery Tickets", "LT")
	{
		_iexecDoracleUpdateSettings(
			_app,
			_dataset,
			_workerpool,
			TAG,
			TRUST
		);
		token = iexecClerk.token();
	}

	/***************************************************************************
	 *                                 LOTTERY                                 *
	 ***************************************************************************/
	function createLottery(
		uint256 _ticketPrice,
		uint256 _ticketMaxCount,
		uint256 _duration)
	public
	{
		uint256 lotteryID = lotteryMetadata.length++;

		LotteryMetadata storage details = lotteryMetadata[lotteryID];
		details.status               = LotteryStatusEnum.OPEN;
		details.ticketPrice          = _ticketPrice;
		details.registrationDeadline = now + _duration;
		details.ticketMaxCount       = _ticketMaxCount;

		emit NewLottery(lotteryID);
	}

	function receiveApproval(address _sender, uint256, address, bytes calldata _ref)
		external
	{
		require(msg.sender == address(token));
		(uint256 lotteryID) = abi.decode(_ref, (uint256));
		_buyTicket(_sender, lotteryID);
	}

	function buyTicket(uint256 lotteryID)
		external
	{
		_buyTicket(msg.sender, lotteryID);
	}

	function _buyTicket(address _buyer, uint256 _lotteryID)
	internal
	{
		// Get lottery details
		LotteryMetadata storage details = lotteryMetadata[_lotteryID];
		require(details.status == LotteryStatusEnum.OPEN);

		// Checks
		require(now <= details.registrationDeadline);
		require(details.ticketCount < details.ticketMaxCount);

		// Pay in tokens
		require(token.transferFrom(_buyer, address(this), details.ticketPrice));

		// Emit ticket
		uint256 ticketID = uint256(keccak256(abi.encode(_lotteryID, details.ticketCount)));
		_mint(_buyer, ticketID);

		// Ticket metadata - use _setTokenURI instead ?
		ticketMetadata[ticketID].lotteryID    = _lotteryID;
		ticketMetadata[ticketID].ticketNumber = details.ticketCount;

		// Details update
		details.potValue    = details.potValue.add(details.ticketPrice);
		details.ticketCount = details.ticketCount.add(1);

		emit NewParticipant(_lotteryID, ticketID);
	}

	function roll(
		uint256                                  _lotteryID,
		IexecODBLibOrders.AppOrder        memory _apporder,
		IexecODBLibOrders.DatasetOrder    memory _datasetorder,
		IexecODBLibOrders.WorkerpoolOrder memory _workerpoolorder)
	public
	{
		// Get lottery details
		LotteryMetadata storage details = lotteryMetadata[_lotteryID];
		require(details.status == LotteryStatusEnum.OPEN);

		// Check lottery status
		require(now > details.registrationDeadline);
		require(details.oracleCall == bytes32(0));

		// Check whitelist
		require(m_authorizedApp        == address(0) || checkIdentity(m_authorizedApp,        _apporder.app,               iexecClerk.GROUPMEMBER_PURPOSE()), "unauthorized-app");
		require(m_authorizedDataset    == address(0) || checkIdentity(m_authorizedDataset,    _datasetorder.dataset,       iexecClerk.GROUPMEMBER_PURPOSE()), "unauthorized-dataset");
		require(m_authorizedWorkerpool == address(0) || checkIdentity(m_authorizedWorkerpool, _workerpoolorder.workerpool, iexecClerk.GROUPMEMBER_PURPOSE()), "unauthorized-workerpool");

		// Create order
		IexecODBLibOrders.RequestOrder memory requestorder;
		requestorder.app                = _apporder.app;                                //address
		requestorder.appmaxprice        = _apporder.appprice;                           //uint256
		requestorder.dataset            = _datasetorder.dataset;                        //address
		requestorder.datasetmaxprice    = _datasetorder.datasetprice;                   //uint256
		requestorder.workerpool         = _workerpoolorder.workerpool;                  //address
		requestorder.workerpoolmaxprice = _workerpoolorder.workerpoolprice;             //uint256
		requestorder.requester          = address(this);                                //address
		requestorder.volume             = 1;                                            //uint256
		requestorder.tag                = TAG;                                          //bytes32
		requestorder.category           = _workerpoolorder.category;                    //uint256
		requestorder.trust              = TRUST;                                        //uint256
		requestorder.beneficiary        = address(0);                                   //address
		requestorder.callback           = address(this);                                //address
		requestorder.params             = PARAMS;                                       //string
		requestorder.salt               = keccak256(abi.encodePacked(now, _lotteryID)); //bytes32

		// Sign order
		require(iexecClerk.signRequestOrder(requestorder));

		// Deposit for deal
		uint256 dealprice = _apporder.appprice.add(_datasetorder.datasetprice).add(_workerpoolorder.workerpoolprice);
		token.approve(address(iexecClerk), dealprice);
		iexecClerk.deposit(dealprice);
		details.potValue = details.potValue.sub(dealprice);

		// Match and retreive details
		bytes32 dealid = iexecClerk.matchOrders(_apporder, _datasetorder, _workerpoolorder, requestorder);
		bytes32 taskid = keccak256(abi.encodePacked(dealid, uint256(0)));

		// Register
		details.status              = LotteryStatusEnum.ROLLING;
		details.oracleCall          = taskid;
		oracleCallToLottery[taskid] = _lotteryID;

		emit NewRoll(_lotteryID, taskid);
	}

	function receiveResult(bytes32 _doracleCallId, bytes memory)
	public
	{
		uint256 lotteryID = oracleCallToLottery[_doracleCallId];

		// Get lottery details
		LotteryMetadata storage details = lotteryMetadata[lotteryID];
		require(details.status == LotteryStatusEnum.ROLLING);

		// Get result
		(bool success, bytes memory results) = _iexecDoracleGetResults(_doracleCallId);

		if (success)
		{
			(uint256 value) = abi.decode(results, (uint256));

			// Identify winner
			uint256 ticketID = uint256(keccak256(abi.encode(lotteryID, value.mod(details.ticketCount))));
			address winner  = ownerOf(ticketID);

			// Reward
			token.transfer(winner, details.potValue);
			emit Reward(lotteryID, winner, details.potValue);

			// Lock for good
			details.status = LotteryStatusEnum.FINISHED;
		}
		else if (keccak256(results) != keccak256("result-not-available")) // any error (other than task not finished)
		{
			details.status     = LotteryStatusEnum.OPEN;
			details.oracleCall = bytes32(0);
		}
	}

	function claim(uint256 _lotteryID)
	public
	{
		// Get lottery details
		LotteryMetadata storage details = lotteryMetadata[_lotteryID];
		require(details.status == LotteryStatusEnum.ROLLING);

		// Get task & deal
		IexecODBLibCore.Task memory task = iexecHub.viewTask(details.oracleCall);
		IexecODBLibCore.Deal memory deal = iexecClerk.viewDeal(task.dealid);

		// Check task status
		require(task.status == IexecODBLibCore.TaskStatusEnum.FAILLED);
		uint256 dealprice = deal.app.price.add(deal.dataset.price).add(deal.workerpool.price);

		// Refund
		iexecClerk.withdraw(dealprice);
		details.status     = LotteryStatusEnum.OPEN;
		details.potValue   = details.potValue.add(dealprice);
		details.oracleCall = bytes32(0);

		emit Claim(_lotteryID);
	}
}
