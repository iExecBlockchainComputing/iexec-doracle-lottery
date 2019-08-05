pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

import "iexec-doracle-base/contracts/IexecDoracle.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol";


contract Lottery is IexecDoracle, ERC721Full
{
	using SafeMath for uint256;

	bytes32 public constant TAG    = 0x0000000000000000000000000000000000000000000000000000000000000001; // NO TEE
	uint256 public constant TRUST  = 0; // No replication
	string  public constant PARAMS = "python3 /app/randomGenerator.py";

	IERC20 public token;

	enum LotteryStatusEnum
	{
		NULL,
		ACTIVE,
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
		uint256 crowdsaleDeadline;
	}

	struct TicketMetadata
	{
		uint256 lotteryID;
		uint256 ticketNumber;
	}

	LotteryMetadata[]                  private m_lotteryMetadata;
	mapping(uint256 => TicketMetadata) private m_ticketMetadata;
	mapping(bytes32 => uint256       ) private m_oracleCallToLottery;

	event NewLottery    (uint256 indexed lotteryid);
	event NewParticipant(uint256 indexed lotteryid, uint256 ticketid);
	event NewRoll       (uint256 indexed lotteryid, bytes32 taskid);
	event Reward        (uint256 indexed lotteryid, address winner, uint256 value);
	event Faillure      (uint256 indexed lotteryid);
	event Claim         (uint256 indexed lotteryid);

	modifier crowSaleActive(uint256 _lotteryID)
	{
		LotteryMetadata storage details = m_lotteryMetadata[_lotteryID];
		require(now <= details.crowdsaleDeadline);
		require(details.ticketCount < details.ticketMaxCount);
		_;
	}
	modifier crowSaleFinished(uint256 _lotteryID)
	{
		LotteryMetadata storage details = m_lotteryMetadata[_lotteryID];
		require(now > details.crowdsaleDeadline);
		_;
	}

	/***************************************************************************
	 *                               Constructor                               *
	 ***************************************************************************/
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

	function countLottery       (                  ) external view returns (uint256               ) { return m_lotteryMetadata.length;          }
	function viewLottery        (uint256 lotteryID ) external view returns (LotteryMetadata memory) { return m_lotteryMetadata    [lotteryID];  }
	function viewTicket         (uint256 ticketID  ) external view returns (TicketMetadata  memory) { return m_ticketMetadata     [ticketID];   }
	function oracleCallToLottery(bytes32 oracleCall) external view returns (uint256               ) { return m_oracleCallToLottery[oracleCall]; }

	/***************************************************************************
	 *                          LOTTERY - Create game                          *
	 ***************************************************************************/
	function createLottery(
		uint256 _ticketPrice,
		uint256 _ticketMaxCount,
		uint256 _duration)
	public
	{
		uint256 lotteryID = m_lotteryMetadata.length++;

		LotteryMetadata storage details = m_lotteryMetadata[lotteryID];
		details.status            = LotteryStatusEnum.ACTIVE;
		details.ticketPrice       = _ticketPrice;
		details.crowdsaleDeadline = now + _duration;
		details.ticketMaxCount    = _ticketMaxCount;

		emit NewLottery(lotteryID);
	}

	/***************************************************************************
	 *                          LOTTERY - Buy ticket                           *
	 ***************************************************************************/
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
	internal crowSaleActive(_lotteryID)
	{
		// Get lottery details
		LotteryMetadata storage details = m_lotteryMetadata[_lotteryID];

		// Pay in tokens
		require(token.transferFrom(_buyer, address(this), details.ticketPrice));

		// Emit ticket
		uint256 ticketID = mintTicket(_lotteryID, details.ticketCount, _buyer);

		// Details update
		details.potValue    = details.potValue.add(details.ticketPrice);
		details.ticketCount = details.ticketCount.add(1);

		emit NewParticipant(_lotteryID, ticketID);
	}

	/***************************************************************************
	 *                             LOTTERY - Roll                              *
	 ***************************************************************************/
	function roll(
		uint256                                  _lotteryID,
		IexecODBLibOrders.AppOrder        memory _apporder,
		IexecODBLibOrders.DatasetOrder    memory _datasetorder,
		IexecODBLibOrders.WorkerpoolOrder memory _workerpoolorder)
	public crowSaleFinished(_lotteryID)
	{
		// Get lottery details
		LotteryMetadata storage details = m_lotteryMetadata[_lotteryID];

		// Check lottery status
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

		// Deposit for deal & remove from pot
		uint256 dealprice = _apporder.appprice.add(_datasetorder.datasetprice).add(_workerpoolorder.workerpoolprice);
		iExecDeposit(dealprice);
		details.potValue = details.potValue.sub(dealprice);

		// Match and retreive details
		bytes32 dealid = iexecClerk.matchOrders(_apporder, _datasetorder, _workerpoolorder, requestorder);
		bytes32 taskid = keccak256(abi.encodePacked(dealid, uint256(0)));

		// Register
		details.oracleCall            = taskid;
		m_oracleCallToLottery[taskid] = _lotteryID;

		emit NewRoll(_lotteryID, taskid);
	}

	/***************************************************************************
	 *                            LOTTERY - Resolve                            *
	 ***************************************************************************/
	function receiveResult(bytes32 _doracleCallId, bytes memory)
	public
	{
		uint256 lotteryID = m_oracleCallToLottery[_doracleCallId];

		// Get lottery details
		LotteryMetadata storage details = m_lotteryMetadata[lotteryID];
		require(details.status == LotteryStatusEnum.ACTIVE);

		// Get result
		(bool success, bytes memory results) = _iexecDoracleGetResults(_doracleCallId);

		if (success)
		{
			// Identify winner
			address winner = ownerOf(getTicketID(
				lotteryID,
				abi.decode(results, (uint256)).mod(details.ticketCount) // random value modulo ticketCount
			));

			// Reward
			token.transfer(winner, details.potValue);

			// Lock for good (prevent reentry)
			details.status = LotteryStatusEnum.FINISHED;

			// Notify
			emit Reward(lotteryID, winner, details.potValue);
		}
		else if (keccak256(results) != keccak256("result-not-available")) // any error (other than task not finished)
		{
			// Unlock
			details.oracleCall = bytes32(0);

			// Notify
			emit Faillure(lotteryID);
		}
	}

	/***************************************************************************
	 *                             LOTTERY - Claim                             *
	 ***************************************************************************/
	function claim(uint256 _lotteryID)
	public
	{
		// Get lottery details
		LotteryMetadata storage details = m_lotteryMetadata[_lotteryID];

		// Get task & dealvalue
		IexecODBLibCore.Task memory task = iexecHub.viewTask(details.oracleCall);
		IexecODBLibCore.Deal memory deal = iexecClerk.viewDeal(task.dealid);

		// Check task status
		require(task.status == IexecODBLibCore.TaskStatusEnum.FAILLED);
		uint256 dealprice = deal.app.price.add(deal.dataset.price).add(deal.workerpool.price);

		// Refund
		iexecClerk.withdraw(dealprice);
		details.potValue   = details.potValue.add(dealprice);
		details.oracleCall = bytes32(0);

		emit Claim(_lotteryID);
	}

	/***************************************************************************
	 *                                  Tools                                  *
	 ***************************************************************************/
	function getTicketID(uint256 _lotteryID, uint256 _ticketIndex)
	internal pure returns (uint256)
	{
		return uint256(keccak256(abi.encode(_lotteryID, _ticketIndex)));
	}

	function mintTicket(uint256 _lotteryID, uint256 _ticketIndex, address _buyer)
	internal returns (uint256)
	{
		uint256 ticketID = getTicketID(_lotteryID, _ticketIndex);
		_mint(_buyer, ticketID);
		m_ticketMetadata[ticketID].lotteryID    = _lotteryID;
		m_ticketMetadata[ticketID].ticketNumber = _ticketIndex;
		return ticketID;
	}

	function iExecDeposit(uint256 value)
	internal
	{
		token.approve(address(iexecClerk), value);
		iexecClerk.deposit(value);
	}
}
