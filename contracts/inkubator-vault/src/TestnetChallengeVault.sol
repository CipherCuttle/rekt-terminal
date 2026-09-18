// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

interface IERC20Minimal {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice TESTNET-ONLY Challenge prize vault for Stage J1.
/// @dev Deliberately no owner, upgrade, sweep, arbitrary-recipient, yield, swap, bridge, or generic-call surface.
contract TestnetChallengeVault {
    enum SettlementKind {
        ORGANIZER_WINNER,
        DEFAULT_SINGLE_QUALIFIER_WINNER,
        DEFAULT_DISTRIBUTION,
        REFUND_NO_QUALIFIER,
        CANCELLED_BY_RESOLUTION
    }

    enum QualifierSetCoAuthority {
        ORGANIZER,
        RESOLVER
    }

    struct PayoutMemberInput {
        bytes32 entryDigest;
        address payout;
        bytes32[] payoutProof;
    }

    struct RecipientClaimInput {
        bytes32 entryDigest;
        address payout;
        uint256 amount;
        bytes32[] qualifierProof;
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
    error QualificationAlreadyResolved();
    error QualificationNotResolved();
    error InvalidQualifierSet();
    error InvalidSignature();
    error WrongAuthority();
    error SettlementAlreadyAuthorized();
    error InvalidManifest();
    error InvalidPayoutProof();
    error InvalidQualifierProof();
    error InvalidRecipientSet();
    error InvalidSettlementAmount();
    error NothingToClaim();
    error TokenTransferFailed();
    error Reentrancy();

    event Funded(address indexed funder, uint256 amount);
    event PayoutSetSealed(bytes32 indexed payoutSetRoot, uint16 payoutCount);
    event QualifierSetSealed(
        bytes32 indexed qualifierSetRoot,
        uint16 qualifierCount,
        QualifierSetCoAuthority indexed coAuthority
    );
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
    bytes32 private constant QUALIFIER_SET_TYPEHASH =
        keccak256(
            "QualifierSet(bytes32 challengeDigest,bytes32 termsDigest,bytes32 bindingDigest,bytes32 payoutSetRoot,bytes32 qualifierSetRoot,uint16 qualifierCount,uint8 coAuthority)"
        );
    bytes32 private constant SETTLEMENT_TYPEHASH =
        keccak256(
            "Settlement(bytes32 challengeDigest,bytes32 termsDigest,bytes32 bindingDigest,bytes32 manifestDigest,bytes32 qualifierSetRoot,uint8 kind,bytes32 recipientsDigest)"
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

    bool public qualificationResolved;
    bytes32 public qualifierSetRoot;
    uint16 public qualifierCount;
    QualifierSetCoAuthority public qualifierSetCoAuthority;

    bool public settlementAuthorized;
    bytes32 public authorizedManifestDigest;
    SettlementKind public authorizedKind;
    uint256 public totalCredited;
    uint256 public totalClaimed;

    mapping(address => uint256) public claimable;

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
        if (
            outcomeAuthority_ == organizerSelectionAuthority_ || outcomeAuthority_ == resolverAuthority_
                || organizerSelectionAuthority_ == resolverAuthority_
        ) revert AuthoritiesMustBeIndependent();

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

    function sealQualifierSet(
        PayoutMemberInput[] calldata qualifiers,
        QualifierSetCoAuthority coAuthority,
        bytes calldata outcomeSignature,
        bytes calldata counterpartySignature
    ) external {
        if (!funded) revert NotFunded();
        if (!payoutSetSealed) revert PayoutSetNotSealed();
        if (qualificationResolved) revert QualificationAlreadyResolved();
        if (settlementAuthorized) revert SettlementAlreadyAuthorized();

        uint256 length = qualifiers.length;
        if (length > payoutCount || length > MAX_RECIPIENTS) revert InvalidQualifierSet();

        bytes32[] memory leaves = new bytes32[](length);
        bytes32 previousEntry;

        for (uint256 index = 0; index < length; ++index) {
            PayoutMemberInput calldata qualifier = qualifiers[index];
            if (qualifier.entryDigest == bytes32(0) || qualifier.payout == address(0)) revert InvalidQualifierSet();
            if (index != 0 && uint256(qualifier.entryDigest) <= uint256(previousEntry)) revert InvalidQualifierSet();
            previousEntry = qualifier.entryDigest;

            for (uint256 prior = 0; prior < index; ++prior) {
                if (qualifiers[prior].payout == qualifier.payout) revert InvalidQualifierSet();
            }

            if (!_verifyProof(payoutLeaf(qualifier.entryDigest, qualifier.payout), qualifier.payoutProof, payoutSetRoot)) {
                revert InvalidPayoutProof();
            }

            leaves[index] = payoutLeaf(qualifier.entryDigest, qualifier.payout);
        }

        bytes32 root = _rootFromLeaves(leaves);
        bytes32 digest = qualifierSetAuthorizationDigest(root, uint16(length), coAuthority);
        _requireSigner(digest, outcomeSignature, outcomeAuthority);

        address expectedCounterparty = coAuthority == QualifierSetCoAuthority.ORGANIZER
            ? organizerSelectionAuthority
            : resolverAuthority;
        _requireSigner(digest, counterpartySignature, expectedCounterparty);

        qualificationResolved = true;
        qualifierSetRoot = root;
        qualifierCount = uint16(length);
        qualifierSetCoAuthority = coAuthority;

        emit QualifierSetSealed(root, uint16(length), coAuthority);
    }

    function authorizeOrganizerWinner(
        bytes32 manifestDigest,
        RecipientClaimInput calldata recipient,
        bytes calldata outcomeSignature,
        bytes calldata organizerSignature
    ) external {
        _requireSettlementReady();
        _requireQualifierResolution(1);
        if (manifestDigest == bytes32(0)) revert InvalidManifest();
        if (recipient.amount != prizeAmount || recipient.payout == address(0)) revert InvalidSettlementAmount();
        _requireQualifierProof(recipient);

        bytes32 recipientsDigest = _singleRecipientDigest(recipient.entryDigest, recipient.payout, recipient.amount);
        bytes32 digest = settlementAuthorizationDigest(
            manifestDigest,
            qualifierSetRoot,
            SettlementKind.ORGANIZER_WINNER,
            recipientsDigest
        );

        _requireSigner(digest, outcomeSignature, outcomeAuthority);
        _requireSigner(digest, organizerSignature, organizerSelectionAuthority);

        _credit(recipient.payout, recipient.amount);
        _authorize(manifestDigest, SettlementKind.ORGANIZER_WINNER);
    }

    function authorizeSingleQualifierDefault(
        bytes32 manifestDigest,
        RecipientClaimInput calldata recipient,
        bytes calldata outcomeSignature
    ) external {
        _requireSettlementReady();
        if (!qualificationResolved || qualifierCount != 1) revert InvalidQualifierSet();
        if (manifestDigest == bytes32(0)) revert InvalidManifest();
        if (recipient.amount != prizeAmount || recipient.payout == address(0)) revert InvalidSettlementAmount();
        _requireQualifierProof(recipient);

        bytes32 recipientsDigest = _singleRecipientDigest(recipient.entryDigest, recipient.payout, recipient.amount);
        bytes32 digest = settlementAuthorizationDigest(
            manifestDigest,
            qualifierSetRoot,
            SettlementKind.DEFAULT_SINGLE_QUALIFIER_WINNER,
            recipientsDigest
        );
        _requireSigner(digest, outcomeSignature, outcomeAuthority);

        _credit(recipient.payout, recipient.amount);
        _authorize(manifestDigest, SettlementKind.DEFAULT_SINGLE_QUALIFIER_WINNER);
    }

    function authorizeDefaultDistribution(
        bytes32 manifestDigest,
        RecipientClaimInput[] calldata recipients,
        bytes calldata outcomeSignature
    ) external {
        _requireSettlementReady();
        if (!qualificationResolved || qualifierCount < 2) revert InvalidQualifierSet();
        if (manifestDigest == bytes32(0)) revert InvalidManifest();

        uint256 length = recipients.length;
        if (length != qualifierCount || length > MAX_RECIPIENTS) revert InvalidRecipientSet();

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

            for (uint256 prior = 0; prior < index; ++prior) {
                if (recipients[prior].payout == recipient.payout) revert InvalidRecipientSet();
            }

            _requireQualifierProof(recipient);

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
            manifestDigest,
            qualifierSetRoot,
            SettlementKind.DEFAULT_DISTRIBUTION,
            recipientsDigest
        );
        _requireSigner(digest, outcomeSignature, outcomeAuthority);

        for (uint256 index = 0; index < length; ++index) {
            _credit(recipients[index].payout, recipients[index].amount);
        }
        _authorize(manifestDigest, SettlementKind.DEFAULT_DISTRIBUTION);
    }

    function authorizeNoQualifierRefund(bytes32 manifestDigest, bytes calldata outcomeSignature) external {
        _requireSettlementReady();
        if (!qualificationResolved || qualifierCount != 0) revert InvalidQualifierSet();
        if (manifestDigest == bytes32(0)) revert InvalidManifest();

        bytes32 recipientsDigest = _singleRecipientDigest(bytes32(0), refundRecipient, prizeAmount);
        bytes32 digest = settlementAuthorizationDigest(
            manifestDigest,
            qualifierSetRoot,
            SettlementKind.REFUND_NO_QUALIFIER,
            recipientsDigest
        );
        _requireSigner(digest, outcomeSignature, outcomeAuthority);

        _credit(refundRecipient, prizeAmount);
        _authorize(manifestDigest, SettlementKind.REFUND_NO_QUALIFIER);
    }

    function authorizeResolutionCancellation(
        bytes32 manifestDigest,
        bytes calldata outcomeSignature,
        bytes calldata resolverSignature
    ) external {
        _requireSettlementReady();
        if (manifestDigest == bytes32(0)) revert InvalidManifest();

        bytes32 recipientsDigest = _singleRecipientDigest(bytes32(0), refundRecipient, prizeAmount);
        bytes32 digest = settlementAuthorizationDigest(
            manifestDigest,
            qualifierSetRoot,
            SettlementKind.CANCELLED_BY_RESOLUTION,
            recipientsDigest
        );

        // J1 models the future resolver threshold with one test EOA, so an independent
        // outcome co-sign is required here to preserve the no-single-compromise invariant.
        _requireSigner(digest, outcomeSignature, outcomeAuthority);
        _requireSigner(digest, resolverSignature, resolverAuthority);

        _credit(refundRecipient, prizeAmount);
        _authorize(manifestDigest, SettlementKind.CANCELLED_BY_RESOLUTION);
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

    function qualifierSetAuthorizationDigest(
        bytes32 root,
        uint16 count,
        QualifierSetCoAuthority coAuthority
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                QUALIFIER_SET_TYPEHASH,
                challengeDigest,
                termsDigest,
                bindingDigest,
                payoutSetRoot,
                root,
                count,
                uint8(coAuthority)
            )
        );
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

    function _requireSettlementReady() internal view {
        if (!funded) revert NotFunded();
        if (settlementAuthorized) revert SettlementAlreadyAuthorized();
    }

    function _requireQualifierResolution(uint16 minimumCount) internal view {
        if (!qualificationResolved) revert QualificationNotResolved();
        if (qualifierCount < minimumCount) revert InvalidQualifierSet();
    }

    function _authorize(bytes32 manifestDigest, SettlementKind kind) internal {
        if (totalCredited != prizeAmount) revert InvalidSettlementAmount();
        settlementAuthorized = true;
        authorizedManifestDigest = manifestDigest;
        authorizedKind = kind;
        emit SettlementAuthorized(manifestDigest, kind, prizeAmount);
    }

    function _credit(address recipient, uint256 amount) internal {
        if (recipient == address(0)) revert ZeroAddress();
        claimable[recipient] += amount;
        totalCredited += amount;
        if (totalCredited > prizeAmount) revert InvalidSettlementAmount();
    }

    function _requireQualifierProof(RecipientClaimInput calldata recipient) internal view {
        if (!_verifyProof(payoutLeaf(recipient.entryDigest, recipient.payout), recipient.qualifierProof, qualifierSetRoot)) {
            revert InvalidQualifierProof();
        }
    }

    function _verifyProof(bytes32 leaf, bytes32[] calldata proof, bytes32 root) internal pure returns (bool) {
        bytes32 computed = leaf;
        for (uint256 index = 0; index < proof.length; ++index) {
            computed = merklePair(computed, proof[index]);
        }
        return computed == root;
    }

    function _rootFromLeaves(bytes32[] memory leaves) internal pure returns (bytes32) {
        if (leaves.length == 0) return bytes32(0);
        if (leaves.length == 1) return leaves[0];
        if (leaves.length == 2) return merklePair(leaves[0], leaves[1]);
        if (leaves.length == 3) {
            return merklePair(merklePair(leaves[0], leaves[1]), merklePair(leaves[2], leaves[2]));
        }
        revert InvalidQualifierSet();
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
