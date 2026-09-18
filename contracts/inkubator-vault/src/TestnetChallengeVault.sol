// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

interface IERC20Minimal {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice TESTNET-ONLY Challenge prize vault for Stage J1.
/// @dev This contract deliberately has no owner, upgrade, sweep, arbitrary-recipient,
///      or mainnet deployment surface. Production use requires a later audited version.
contract TestnetChallengeVault {
    enum SettlementKind {
        WINNER_PAYOUT,
        DEFAULT_DISTRIBUTION,
        REFUND_NO_QUALIFIER,
        CANCELLED_BY_RESOLUTION
    }

    struct RecipientClaimInput {
        bytes32 entryDigest;
        address payout;
        uint256 amount;
        bytes32[] proof;
    }

    error ZeroAddress();
    error ZeroDigest();
    error InvalidPrizeAmount();
    error AuthoritiesMustBeIndependent();
    error AlreadyFunded();
    error NotFunded();
    error UnexpectedPreFundingBalance();
    error FundingAmountMismatch();
    error PayoutSetAlreadySealed();
    error PayoutSetNotSealed();
    error InvalidPayoutSet();
    error InvalidSignature();
    error WrongAuthority();
    error SettlementAlreadyAuthorized();
    error InvalidManifest();
    error InvalidPayoutProof();
    error InvalidRecipientSet();
    error InvalidSettlementAmount();
    error NothingToClaim();
    error TokenTransferFailed();
    error Reentrancy();

    event Funded(address indexed funder, uint256 amount);
    event PayoutSetSealed(bytes32 indexed payoutSetRoot, uint16 payoutCount);
    event SettlementAuthorized(bytes32 indexed manifestDigest, SettlementKind indexed kind, uint256 totalAmount);
    event Claimed(address indexed recipient, uint256 amount);
    event SettlementFinalized(bytes32 indexed manifestDigest, SettlementKind indexed kind);

    uint16 public constant MAX_RECIPIENTS = 3;

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant PAYOUT_SET_TYPEHASH =
        keccak256(
            "PayoutSet(bytes32 challengeDigest,bytes32 termsDigest,bytes32 bindingDigest,bytes32 payoutSetRoot,uint16 payoutCount)"
        );
    bytes32 private constant SETTLEMENT_TYPEHASH =
        keccak256(
            "Settlement(bytes32 challengeDigest,bytes32 termsDigest,bytes32 bindingDigest,bytes32 manifestDigest,bytes32 payoutSetRoot,uint8 kind,bytes32 recipientsDigest)"
        );
    bytes32 private constant NAME_HASH = keccak256("REKT Inkubator Testnet Challenge Vault");
    bytes32 private constant VERSION_HASH = keccak256("1");
    uint256 private constant SECP256K1N_HALF =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    IERC20Minimal public immutable token;
    bytes32 public immutable challengeDigest;
    bytes32 public immutable termsDigest;
    bytes32 public immutable bindingDigest;
    uint256 public immutable prizeAmount;
    address public immutable refundRecipient;
    address public immutable outcomeAuthority;
    address public immutable organizerSelectionAuthority;
    address public immutable resolverAuthority;

    bool public funded;
    bool public payoutSetSealed;
    bytes32 public payoutSetRoot;
    uint16 public payoutCount;

    bool public settlementAuthorized;
    bytes32 public authorizedManifestDigest;
    SettlementKind public authorizedKind;

    mapping(address => uint256) public claimable;
    uint256 public totalClaimed;

    uint256 private guard = 1;

    constructor(
        IERC20Minimal token_,
        bytes32 challengeDigest_,
        bytes32 termsDigest_,
        bytes32 bindingDigest_,
        uint256 prizeAmount_,
        address refundRecipient_,
        address outcomeAuthority_,
        address organizerSelectionAuthority_,
        address resolverAuthority_
    ) {
        if (
            address(token_) == address(0) || refundRecipient_ == address(0) || outcomeAuthority_ == address(0)
                || organizerSelectionAuthority_ == address(0) || resolverAuthority_ == address(0)
        ) revert ZeroAddress();
        if (challengeDigest_ == bytes32(0) || termsDigest_ == bytes32(0) || bindingDigest_ == bytes32(0)) {
            revert ZeroDigest();
        }
        if (prizeAmount_ == 0) revert InvalidPrizeAmount();
        if (outcomeAuthority_ == organizerSelectionAuthority_) revert AuthoritiesMustBeIndependent();

        token = token_;
        challengeDigest = challengeDigest_;
        termsDigest = termsDigest_;
        bindingDigest = bindingDigest_;
        prizeAmount = prizeAmount_;
        refundRecipient = refundRecipient_;
        outcomeAuthority = outcomeAuthority_;
        organizerSelectionAuthority = organizerSelectionAuthority_;
        resolverAuthority = resolverAuthority_;
    }

    function fund() external {
        if (funded) revert AlreadyFunded();

        uint256 beforeBalance = _tokenBalance();
        if (beforeBalance != 0) revert UnexpectedPreFundingBalance();

        _safeTransferFrom(msg.sender, address(this), prizeAmount);

        uint256 afterBalance = _tokenBalance();
        if (afterBalance != prizeAmount || afterBalance - beforeBalance != prizeAmount) {
            revert FundingAmountMismatch();
        }

        funded = true;
        emit Funded(msg.sender, prizeAmount);
    }

    function sealPayoutSet(
        bytes32 root,
        uint16 count,
        bytes calldata outcomeSignature,
        bytes calldata organizerSignature
    ) external {
        if (!funded) revert NotFunded();
        if (payoutSetSealed) revert PayoutSetAlreadySealed();
        if (settlementAuthorized) revert SettlementAlreadyAuthorized();
        if (root == bytes32(0) || count == 0 || count > MAX_RECIPIENTS) revert InvalidPayoutSet();

        bytes32 digest = payoutSetAuthorizationDigest(root, count);
        _requireSigner(digest, outcomeSignature, outcomeAuthority);
        _requireSigner(digest, organizerSignature, organizerSelectionAuthority);

        payoutSetRoot = root;
        payoutCount = count;
        payoutSetSealed = true;

        emit PayoutSetSealed(root, count);
    }

    function authorizeWinner(
        bytes32 manifestDigest,
        RecipientClaimInput calldata recipient,
        bytes calldata outcomeSignature,
        bytes calldata organizerSignature
    ) external {
        _requireSettlementReady(true);
        if (manifestDigest == bytes32(0)) revert InvalidManifest();
        if (recipient.amount != prizeAmount || recipient.payout == address(0)) revert InvalidSettlementAmount();
        _requirePayoutProof(recipient);

        bytes32 recipientsDigest = _singleRecipientDigest(recipient.entryDigest, recipient.payout, recipient.amount);
        bytes32 digest =
            settlementAuthorizationDigest(manifestDigest, payoutSetRoot, SettlementKind.WINNER_PAYOUT, recipientsDigest);

        _requireSigner(digest, outcomeSignature, outcomeAuthority);
        _requireSigner(digest, organizerSignature, organizerSelectionAuthority);

        _authorize(manifestDigest, SettlementKind.WINNER_PAYOUT);
        _credit(recipient.payout, recipient.amount);
    }

    function authorizeDefaultDistribution(
        bytes32 manifestDigest,
        RecipientClaimInput[] calldata recipients,
        bytes calldata outcomeSignature
    ) external {
        _requireSettlementReady(true);
        if (manifestDigest == bytes32(0)) revert InvalidManifest();

        uint256 length = recipients.length;
        if (length < 2 || length > payoutCount || length > MAX_RECIPIENTS) revert InvalidRecipientSet();

        uint256 base = prizeAmount / length;
        uint256 remainder = prizeAmount % length;
        uint256 ceilCount;
        uint256 total;
        bytes32 previousEntry;
        bytes32 recipientsDigest = keccak256("");

        for (uint256 index = 0; index < length; ++index) {
            RecipientClaimInput calldata recipient = recipients[index];
            if (recipient.payout == address(0) || recipient.entryDigest == bytes32(0)) revert InvalidRecipientSet();
            if (index != 0 && uint256(recipient.entryDigest) <= uint256(previousEntry)) revert InvalidRecipientSet();
            previousEntry = recipient.entryDigest;

            _requirePayoutProof(recipient);

            if (recipient.amount == base + 1) {
                ++ceilCount;
            } else if (recipient.amount != base) {
                revert InvalidSettlementAmount();
            }

            total += recipient.amount;
            recipientsDigest =
                keccak256(abi.encode(recipientsDigest, recipientItemHash(recipient.entryDigest, recipient.payout, recipient.amount)));
        }

        if (total != prizeAmount || ceilCount != remainder) revert InvalidSettlementAmount();

        bytes32 digest = settlementAuthorizationDigest(
            manifestDigest, payoutSetRoot, SettlementKind.DEFAULT_DISTRIBUTION, recipientsDigest
        );
        _requireSigner(digest, outcomeSignature, outcomeAuthority);

        _authorize(manifestDigest, SettlementKind.DEFAULT_DISTRIBUTION);
        for (uint256 index = 0; index < length; ++index) {
            _credit(recipients[index].payout, recipients[index].amount);
        }
    }

    function authorizeNoQualifierRefund(bytes32 manifestDigest, bytes calldata outcomeSignature) external {
        _requireSettlementReady(true);
        if (manifestDigest == bytes32(0)) revert InvalidManifest();

        bytes32 recipientsDigest = _singleRecipientDigest(bytes32(0), refundRecipient, prizeAmount);
        bytes32 digest = settlementAuthorizationDigest(
            manifestDigest, payoutSetRoot, SettlementKind.REFUND_NO_QUALIFIER, recipientsDigest
        );
        _requireSigner(digest, outcomeSignature, outcomeAuthority);

        _authorize(manifestDigest, SettlementKind.REFUND_NO_QUALIFIER);
        _credit(refundRecipient, prizeAmount);
    }

    function authorizeResolutionCancellation(bytes32 manifestDigest, bytes calldata resolverSignature) external {
        _requireSettlementReady(false);
        if (manifestDigest == bytes32(0)) revert InvalidManifest();

        bytes32 recipientsDigest = _singleRecipientDigest(bytes32(0), refundRecipient, prizeAmount);
        bytes32 digest = settlementAuthorizationDigest(
            manifestDigest, payoutSetRoot, SettlementKind.CANCELLED_BY_RESOLUTION, recipientsDigest
        );
        _requireSigner(digest, resolverSignature, resolverAuthority);

        _authorize(manifestDigest, SettlementKind.CANCELLED_BY_RESOLUTION);
        _credit(refundRecipient, prizeAmount);
    }

    /// @notice Anyone may trigger an already-authorized claim, but funds always go to the frozen recipient.
    function claimFor(address recipient) external {
        if (guard != 1) revert Reentrancy();
        guard = 2;

        uint256 amount = claimable[recipient];
        if (amount == 0) revert NothingToClaim();

        claimable[recipient] = 0;
        totalClaimed += amount;

        _safeTransfer(recipient, amount);
        emit Claimed(recipient, amount);

        if (totalClaimed == prizeAmount) {
            emit SettlementFinalized(authorizedManifestDigest, authorizedKind);
        }

        guard = 1;
    }

    function isFinalized() external view returns (bool) {
        return settlementAuthorized && totalClaimed == prizeAmount;
    }

    function remainingLiability() external view returns (uint256) {
        return prizeAmount - totalClaimed;
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    function payoutSetAuthorizationDigest(bytes32 root, uint16 count) public view returns (bytes32) {
        bytes32 structHash =
            keccak256(abi.encode(PAYOUT_SET_TYPEHASH, challengeDigest, termsDigest, bindingDigest, root, count));
        return _hashTypedData(structHash);
    }

    function settlementAuthorizationDigest(
        bytes32 manifestDigest,
        bytes32 root,
        SettlementKind kind,
        bytes32 recipientsDigest
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                SETTLEMENT_TYPEHASH,
                challengeDigest,
                termsDigest,
                bindingDigest,
                manifestDigest,
                root,
                uint8(kind),
                recipientsDigest
            )
        );
        return _hashTypedData(structHash);
    }

    function payoutLeaf(bytes32 entryDigest, address payout) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(bytes1(0x00), entryDigest, payout));
    }

    function merklePair(bytes32 left, bytes32 right) public pure returns (bytes32) {
        if (uint256(left) > uint256(right)) (left, right) = (right, left);
        return keccak256(abi.encodePacked(bytes1(0x01), left, right));
    }

    function recipientItemHash(bytes32 entryDigest, address payout, uint256 amount) public pure returns (bytes32) {
        return keccak256(abi.encode(entryDigest, payout, amount));
    }

    function singleRecipientDigest(bytes32 entryDigest, address payout, uint256 amount)
        external
        pure
        returns (bytes32)
    {
        return _singleRecipientDigest(entryDigest, payout, amount);
    }

    function _singleRecipientDigest(bytes32 entryDigest, address payout, uint256 amount)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(keccak256(""), recipientItemHash(entryDigest, payout, amount)));
    }

    function _requireSettlementReady(bool requirePayoutSet) internal view {
        if (!funded) revert NotFunded();
        if (settlementAuthorized) revert SettlementAlreadyAuthorized();
        if (requirePayoutSet && !payoutSetSealed) revert PayoutSetNotSealed();
    }

    function _authorize(bytes32 manifestDigest, SettlementKind kind) internal {
        settlementAuthorized = true;
        authorizedManifestDigest = manifestDigest;
        authorizedKind = kind;
        emit SettlementAuthorized(manifestDigest, kind, prizeAmount);
    }

    function _credit(address recipient, uint256 amount) internal {
        if (recipient == address(0)) revert ZeroAddress();
        claimable[recipient] += amount;
    }

    function _requirePayoutProof(RecipientClaimInput calldata recipient) internal view {
        bytes32 computed = payoutLeaf(recipient.entryDigest, recipient.payout);
        for (uint256 index = 0; index < recipient.proof.length; ++index) {
            computed = merklePair(computed, recipient.proof[index]);
        }
        if (computed != payoutSetRoot) revert InvalidPayoutProof();
    }

    function _hashTypedData(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(bytes2(0x1901), domainSeparator(), structHash));
    }

    function _requireSigner(bytes32 digest, bytes calldata signature, address expected) internal pure {
        if (_recover(digest, signature) != expected) revert WrongAuthority();
    }

    function _recover(bytes32 digest, bytes calldata signature) internal pure returns (address signer) {
        if (signature.length != 65) revert InvalidSignature();

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (uint256(s) > SECP256K1N_HALF || (v != 27 && v != 28)) revert InvalidSignature();
        signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
    }

    function _tokenBalance() internal view returns (uint256 amount) {
        (bool ok, bytes memory data) =
            address(token).staticcall(abi.encodeCall(IERC20Minimal.balanceOf, (address(this))));
        if (!ok || data.length < 32) revert TokenTransferFailed();
        amount = abi.decode(data, (uint256));
    }

    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        _callOptionalReturn(abi.encodeCall(IERC20Minimal.transferFrom, (from, to, amount)));
    }

    function _safeTransfer(address to, uint256 amount) internal {
        _callOptionalReturn(abi.encodeCall(IERC20Minimal.transfer, (to, amount)));
    }

    function _callOptionalReturn(bytes memory callData) internal {
        (bool ok, bytes memory returnData) = address(token).call(callData);
        if (!ok) revert TokenTransferFailed();
        if (returnData.length != 0 && !abi.decode(returnData, (bool))) revert TokenTransferFailed();
    }
}
