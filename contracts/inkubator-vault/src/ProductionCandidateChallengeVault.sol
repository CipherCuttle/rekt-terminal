// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

interface IERC20ProductionCandidate {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IERC1271Resolver {
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4);
}

/// @notice Stage-J4 production-candidate Challenge prize vault.
/// @dev Candidate only: no deployment authority, owner, upgrade, sweep, arbitrary call, fee, yield, swap, or bridge.
contract ProductionCandidateChallengeVault {
    enum SettlementKind {
        ORGANIZER_WINNER,
        DEFAULT_SINGLE_QUALIFIER_WINNER,
        DEFAULT_DISTRIBUTION,
        REFUND_NO_QUALIFIER,
        REFUND_PRE_BUILD,
        REFUND_TERMINAL
    }

    enum QualifierSetMode {
        NORMAL,
        RECOVERY
    }

    struct VaultConfig {
        IERC20ProductionCandidate token;
        bytes32 challengeDigest;
        bytes32 termsDigest;
        bytes32 bindingDigest;
        uint256 prizeAmount;
        uint256 activationDeadline;
        uint256 organizerSelectionDeadline;
        uint256 resolutionDeadline;
        uint256 terminalLongStop;
        address refundRecipient;
        address outcomeAuthority;
        address organizerSelectionAuthority;
        address resolverAuthority;
        bytes32 preBuildRefundManifestDigest;
        bytes32 terminalRefundManifestDigest;
    }

    struct PayoutMemberInput {
        bytes32 entryDigest;
        uint16 payoutOrder;
        address payout;
        bytes32[] payoutProof;
    }

    struct RecipientClaimInput {
        bytes32 entryDigest;
        uint16 payoutOrder;
        address payout;
        uint256 amount;
        bytes32[] qualifierProof;
    }

    error ZeroAddress();
    error ZeroDigest();
    error InvalidPrizeAmount();
    error InvalidDeadlines();
    error AuthoritiesMustBeIndependent();
    error ResolverMustBeContract();
    error AlreadyFunded();
    error NotFunded();
    error FundingAmountMismatch();
    error PayoutSetAlreadySealed();
    error PayoutSetNotSealed();
    error ActivationExpired();
    error InvalidPayoutSet();
    error QualificationAlreadyResolved();
    error QualificationNotResolved();
    error InvalidQualifierSet();
    error InvalidSignature();
    error WrongAuthority();
    error SettlementAlreadyAuthorized();
    error OrganizerSelectionExpired();
    error DefaultNotEligible();
    error RecoveryNotEligible();
    error TerminalNotEligible();
    error PreBuildRefundNotEligible();
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
        bytes32 indexed defaultManifestDigest,
        QualifierSetMode mode,
        bytes32 recoveryEvidenceDigest
    );
    event SettlementAuthorized(bytes32 indexed manifestDigest, SettlementKind indexed kind, uint256 totalAmount);
    event Claimed(address indexed recipient, uint256 amount);
    event SettlementFinalized(bytes32 indexed manifestDigest, SettlementKind indexed kind);

    uint16 public constant MAX_RECIPIENTS = 3;
    bytes4 private constant ERC1271_MAGICVALUE = 0x1626ba7e;

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant PAYOUT_SET_TYPEHASH =
        keccak256(
            "PayoutSet(bytes32 challengeDigest,bytes32 termsDigest,bytes32 bindingDigest,bytes32 payoutSetRoot,uint16 payoutCount)"
        );
    bytes32 private constant QUALIFIER_SET_TYPEHASH =
        keccak256(
            "QualifierSet(bytes32 challengeDigest,bytes32 termsDigest,bytes32 bindingDigest,bytes32 payoutSetRoot,bytes32 qualifierSetRoot,uint16 qualifierCount,bytes32 defaultManifestDigest,bytes32 recoveryEvidenceDigest,uint8 mode)"
        );
    bytes32 private constant SETTLEMENT_TYPEHASH =
        keccak256(
            "Settlement(bytes32 challengeDigest,bytes32 termsDigest,bytes32 bindingDigest,bytes32 manifestDigest,bytes32 qualifierSetRoot,uint8 kind,bytes32 recipientsDigest)"
        );
    bytes32 private constant NAME_HASH = keccak256("REKT Inkubator Production Candidate Challenge Vault");
    bytes32 private constant VERSION_HASH = keccak256("1");
    uint256 private constant SECP256K1N_HALF =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;
    uint256 private constant RESOLVER_STATICCALL_GAS = 150_000;

    IERC20ProductionCandidate public immutable token;
    bytes32 public immutable challengeDigest;
    bytes32 public immutable termsDigest;
    bytes32 public immutable bindingDigest;
    uint256 public immutable prizeAmount;

    uint256 public immutable activationDeadline;
    uint256 public immutable organizerSelectionDeadline;
    uint256 public immutable resolutionDeadline;
    uint256 public immutable terminalLongStop;

    address public immutable refundRecipient;
    address public immutable outcomeAuthority;
    address public immutable organizerSelectionAuthority;
    address public immutable resolverAuthority;

    bytes32 public immutable preBuildRefundManifestDigest;
    bytes32 public immutable terminalRefundManifestDigest;

    bool public funded;
    bool public payoutSetSealed;
    bytes32 public payoutSetRoot;
    uint16 public payoutCount;

    bool public qualificationResolved;
    bytes32 public qualifierSetRoot;
    uint16 public qualifierCount;
    bytes32 public defaultManifestDigest;
    bytes32 public recoveryEvidenceDigest;
    QualifierSetMode public qualifierSetMode;

    bool public settlementAuthorized;
    bytes32 public authorizedManifestDigest;
    SettlementKind public authorizedKind;
    uint256 public totalCredited;
    uint256 public totalClaimed;

    mapping(address => uint256) public claimable;

    uint256 private guard = 1;

    constructor(VaultConfig memory config) {
        if (
            address(config.token) == address(0) || config.refundRecipient == address(0)
                || config.outcomeAuthority == address(0) || config.organizerSelectionAuthority == address(0)
                || config.resolverAuthority == address(0)
        ) revert ZeroAddress();
        if (
            config.challengeDigest == bytes32(0) || config.termsDigest == bytes32(0)
                || config.bindingDigest == bytes32(0) || config.preBuildRefundManifestDigest == bytes32(0)
                || config.terminalRefundManifestDigest == bytes32(0)
        ) revert ZeroDigest();
        if (config.prizeAmount == 0) revert InvalidPrizeAmount();
        if (
            config.activationDeadline > config.organizerSelectionDeadline
                || config.organizerSelectionDeadline >= config.resolutionDeadline
                || config.resolutionDeadline >= config.terminalLongStop
                || config.organizerSelectionDeadline <= block.timestamp
        ) revert InvalidDeadlines();
        if (
            config.outcomeAuthority == config.organizerSelectionAuthority
                || config.outcomeAuthority == config.resolverAuthority
                || config.organizerSelectionAuthority == config.resolverAuthority
        ) revert AuthoritiesMustBeIndependent();
        if (config.resolverAuthority.code.length == 0) revert ResolverMustBeContract();

        token = config.token;
        challengeDigest = config.challengeDigest;
        termsDigest = config.termsDigest;
        bindingDigest = config.bindingDigest;
        prizeAmount = config.prizeAmount;
        activationDeadline = config.activationDeadline;
        organizerSelectionDeadline = config.organizerSelectionDeadline;
        resolutionDeadline = config.resolutionDeadline;
        terminalLongStop = config.terminalLongStop;
        refundRecipient = config.refundRecipient;
        outcomeAuthority = config.outcomeAuthority;
        organizerSelectionAuthority = config.organizerSelectionAuthority;
        resolverAuthority = config.resolverAuthority;
        preBuildRefundManifestDigest = config.preBuildRefundManifestDigest;
        terminalRefundManifestDigest = config.terminalRefundManifestDigest;
    }

    function fund() external {
        if (funded) revert AlreadyFunded();

        uint256 beforeBalance = _tokenBalance();
        _safeTransferFrom(msg.sender, address(this), prizeAmount);
        uint256 afterBalance = _tokenBalance();

        if (afterBalance < beforeBalance || afterBalance - beforeBalance != prizeAmount) {
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
        if (block.timestamp >= activationDeadline) revert ActivationExpired();
        if (root == bytes32(0) || count == 0 || count > MAX_RECIPIENTS) revert InvalidPayoutSet();

        bytes32 digest = payoutSetAuthorizationDigest(root, count);
        _requireEoaSigner(digest, outcomeSignature, outcomeAuthority);
        _requireEoaSigner(digest, organizerSignature, organizerSelectionAuthority);

        payoutSetRoot = root;
        payoutCount = count;
        payoutSetSealed = true;

        emit PayoutSetSealed(root, count);
    }

    function sealQualifierSetNormal(
        PayoutMemberInput[] calldata qualifiers,
        bytes32 qualifierDefaultManifestDigest,
        bytes calldata outcomeSignature,
        bytes calldata organizerSignature
    ) external {
        _requireQualifierFreezeReady();
        if (block.timestamp >= resolutionDeadline) revert RecoveryNotEligible();
        if (qualifierDefaultManifestDigest == bytes32(0)) revert InvalidManifest();

        bytes32 root = _validateQualifierMembers(qualifiers);
        bytes32 digest = qualifierSetAuthorizationDigest(
            root,
            uint16(qualifiers.length),
            qualifierDefaultManifestDigest,
            bytes32(0),
            QualifierSetMode.NORMAL
        );

        _requireEoaSigner(digest, outcomeSignature, outcomeAuthority);
        _requireEoaSigner(digest, organizerSignature, organizerSelectionAuthority);

        _freezeQualifierSet(
            root,
            uint16(qualifiers.length),
            qualifierDefaultManifestDigest,
            bytes32(0),
            QualifierSetMode.NORMAL
        );
    }

    /// @notice Exceptional pre-resolution recovery under the frozen J3 outcome + resolver authority law.
    function sealQualifierSetRecoveryCoSigned(
        PayoutMemberInput[] calldata qualifiers,
        bytes32 qualifierDefaultManifestDigest,
        bytes32 recoveryEvidenceDigest_,
        bytes calldata outcomeSignature,
        bytes calldata resolverSignature
    ) external {
        _requireQualifierFreezeReady();
        if (block.timestamp >= resolutionDeadline) revert RecoveryNotEligible();
        if (qualifierDefaultManifestDigest == bytes32(0)) revert InvalidManifest();
        if (recoveryEvidenceDigest_ == bytes32(0)) revert ZeroDigest();

        bytes32 root = _validateQualifierMembers(qualifiers);
        bytes32 digest = qualifierSetAuthorizationDigest(
            root,
            uint16(qualifiers.length),
            qualifierDefaultManifestDigest,
            recoveryEvidenceDigest_,
            QualifierSetMode.RECOVERY
        );

        _requireEoaSigner(digest, outcomeSignature, outcomeAuthority);
        _requireResolverSignature(digest, resolverSignature);

        _freezeQualifierSet(
            root,
            uint16(qualifiers.length),
            qualifierDefaultManifestDigest,
            recoveryEvidenceDigest_,
            QualifierSetMode.RECOVERY
        );
    }

    function sealQualifierSetRecovery(
        PayoutMemberInput[] calldata qualifiers,
        bytes32 qualifierDefaultManifestDigest,
        bytes32 recoveryEvidenceDigest_,
        bytes calldata resolverSignature
    ) external {
        _requireQualifierFreezeReady();
        if (block.timestamp < resolutionDeadline || block.timestamp >= terminalLongStop) revert RecoveryNotEligible();
        if (qualifierDefaultManifestDigest == bytes32(0)) revert InvalidManifest();
        if (recoveryEvidenceDigest_ == bytes32(0)) revert ZeroDigest();

        bytes32 root = _validateQualifierMembers(qualifiers);
        bytes32 digest = qualifierSetAuthorizationDigest(
            root,
            uint16(qualifiers.length),
            qualifierDefaultManifestDigest,
            recoveryEvidenceDigest_,
            QualifierSetMode.RECOVERY
        );

        _requireResolverSignature(digest, resolverSignature);

        _freezeQualifierSet(
            root,
            uint16(qualifiers.length),
            qualifierDefaultManifestDigest,
            recoveryEvidenceDigest_,
            QualifierSetMode.RECOVERY
        );
    }

    function authorizeOrganizerWinner(
        bytes32 manifestDigest,
        RecipientClaimInput calldata recipient,
        bytes calldata outcomeSignature,
        bytes calldata organizerSignature
    ) external {
        _requireSettlementReady();
        _requireQualifierResolution(1);
        if (block.timestamp >= organizerSelectionDeadline) revert OrganizerSelectionExpired();
        if (manifestDigest == bytes32(0)) revert InvalidManifest();
        if (recipient.amount != prizeAmount || recipient.payout == address(0)) revert InvalidSettlementAmount();
        _requireQualifierProof(recipient);

        bytes32 recipientsDigest =
            _singleRecipientDigest(recipient.entryDigest, recipient.payoutOrder, recipient.payout, recipient.amount);
        bytes32 digest = settlementAuthorizationDigest(
            manifestDigest,
            qualifierSetRoot,
            SettlementKind.ORGANIZER_WINNER,
            recipientsDigest
        );

        _requireEoaSigner(digest, outcomeSignature, outcomeAuthority);
        _requireEoaSigner(digest, organizerSignature, organizerSelectionAuthority);

        _credit(recipient.payout, recipient.amount);
        _authorize(manifestDigest, SettlementKind.ORGANIZER_WINNER);
    }

    function executeDefaultSingleQualifier(RecipientClaimInput calldata recipient) external {
        _requireSettlementReady();
        if (!qualificationResolved || qualifierCount != 1) revert InvalidQualifierSet();
        if (block.timestamp < organizerSelectionDeadline) revert DefaultNotEligible();
        if (recipient.amount != prizeAmount || recipient.payout == address(0)) revert InvalidSettlementAmount();
        _requireQualifierProof(recipient);

        _credit(recipient.payout, recipient.amount);
        _authorize(defaultManifestDigest, SettlementKind.DEFAULT_SINGLE_QUALIFIER_WINNER);
    }

    function executeDefaultDistribution(RecipientClaimInput[] calldata recipients) external {
        _requireSettlementReady();
        if (!qualificationResolved || qualifierCount < 2) revert InvalidQualifierSet();
        if (block.timestamp < organizerSelectionDeadline) revert DefaultNotEligible();

        uint256 length = recipients.length;
        if (length != qualifierCount || length > MAX_RECIPIENTS) revert InvalidRecipientSet();

        uint256 base = prizeAmount / length;
        uint256 remainder = prizeAmount % length;
        uint256 total;
        uint16 previousOrder;

        for (uint256 index = 0; index < length; ++index) {
            RecipientClaimInput calldata recipient = recipients[index];
            if (recipient.payout == address(0) || recipient.entryDigest == bytes32(0)) revert InvalidRecipientSet();
            if (recipient.payoutOrder >= payoutCount) revert InvalidRecipientSet();
            if (index != 0 && recipient.payoutOrder <= previousOrder) revert InvalidRecipientSet();
            previousOrder = recipient.payoutOrder;

            for (uint256 prior = 0; prior < index; ++prior) {
                if (
                    recipients[prior].payout == recipient.payout
                        || recipients[prior].entryDigest == recipient.entryDigest
                ) revert InvalidRecipientSet();
            }

            _requireQualifierProof(recipient);

            uint256 expectedAmount = base + (index < remainder ? 1 : 0);
            if (recipient.amount != expectedAmount) revert InvalidSettlementAmount();

            total += recipient.amount;
        }

        if (total != prizeAmount) revert InvalidSettlementAmount();

        for (uint256 index = 0; index < length; ++index) {
            _credit(recipients[index].payout, recipients[index].amount);
        }

        _authorize(defaultManifestDigest, SettlementKind.DEFAULT_DISTRIBUTION);
    }

    function executeDefaultNoQualifierRefund() external {
        _requireSettlementReady();
        if (!qualificationResolved || qualifierCount != 0) revert InvalidQualifierSet();
        if (block.timestamp < organizerSelectionDeadline) revert DefaultNotEligible();

        _credit(refundRecipient, prizeAmount);
        _authorize(defaultManifestDigest, SettlementKind.REFUND_NO_QUALIFIER);
    }

    function executePreBuildRefund() external {
        _requireSettlementReady();
        if (payoutSetSealed || block.timestamp < activationDeadline) revert PreBuildRefundNotEligible();

        _credit(refundRecipient, prizeAmount);
        _authorize(preBuildRefundManifestDigest, SettlementKind.REFUND_PRE_BUILD);
    }

    function executeTerminalRefund() external {
        _requireSettlementReady();
        if (!payoutSetSealed || qualificationResolved || block.timestamp < terminalLongStop) {
            revert TerminalNotEligible();
        }

        _credit(refundRecipient, prizeAmount);
        _authorize(terminalRefundManifestDigest, SettlementKind.REFUND_TERMINAL);
    }

    /// @notice Anyone may trigger an authorized claim, but funds always go to the frozen recipient.
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
        bytes32 qualifierDefaultManifestDigest,
        bytes32 recoveryEvidenceDigest_,
        QualifierSetMode mode
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
                qualifierDefaultManifestDigest,
                recoveryEvidenceDigest_,
                uint8(mode)
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

    function payoutLeaf(bytes32 entryDigest, uint16 payoutOrder, address payout) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(bytes1(0x00), entryDigest, payoutOrder, payout));
    }

    function merklePair(bytes32 left, bytes32 right) public pure returns (bytes32) {
        if (uint256(left) > uint256(right)) (left, right) = (right, left);
        return keccak256(abi.encodePacked(bytes1(0x01), left, right));
    }

    function recipientItemHash(bytes32 entryDigest, uint16 payoutOrder, address payout, uint256 amount)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(entryDigest, payoutOrder, payout, amount));
    }

    function singleRecipientDigest(bytes32 entryDigest, uint16 payoutOrder, address payout, uint256 amount)
        external
        pure
        returns (bytes32)
    {
        return _singleRecipientDigest(entryDigest, payoutOrder, payout, amount);
    }

    function _singleRecipientDigest(bytes32 entryDigest, uint16 payoutOrder, address payout, uint256 amount)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(keccak256(""), recipientItemHash(entryDigest, payoutOrder, payout, amount)));
    }

    function _requireQualifierFreezeReady() internal view {
        if (!funded) revert NotFunded();
        if (!payoutSetSealed) revert PayoutSetNotSealed();
        if (qualificationResolved) revert QualificationAlreadyResolved();
        if (settlementAuthorized) revert SettlementAlreadyAuthorized();
    }

    function _validateQualifierMembers(PayoutMemberInput[] calldata qualifiers) internal view returns (bytes32 root) {
        uint256 length = qualifiers.length;
        if (length > payoutCount || length > MAX_RECIPIENTS) revert InvalidQualifierSet();

        bytes32[] memory leaves = new bytes32[](length);
        uint16 previousOrder;

        for (uint256 index = 0; index < length; ++index) {
            PayoutMemberInput calldata qualifier = qualifiers[index];
            if (qualifier.entryDigest == bytes32(0) || qualifier.payout == address(0)) revert InvalidQualifierSet();
            if (qualifier.payoutOrder >= payoutCount) revert InvalidQualifierSet();
            if (index != 0 && qualifier.payoutOrder <= previousOrder) revert InvalidQualifierSet();
            previousOrder = qualifier.payoutOrder;

            for (uint256 prior = 0; prior < index; ++prior) {
                if (
                    qualifiers[prior].payout == qualifier.payout
                        || qualifiers[prior].entryDigest == qualifier.entryDigest
                ) revert InvalidQualifierSet();
            }

            bytes32 leaf = payoutLeaf(qualifier.entryDigest, qualifier.payoutOrder, qualifier.payout);
            if (!_verifyProof(leaf, qualifier.payoutProof, payoutSetRoot)) revert InvalidPayoutProof();
            leaves[index] = leaf;
        }

        root = _rootFromLeaves(leaves);
    }

    function _freezeQualifierSet(
        bytes32 root,
        uint16 count,
        bytes32 qualifierDefaultManifestDigest,
        bytes32 recoveryEvidenceDigest_,
        QualifierSetMode mode
    ) internal {
        qualificationResolved = true;
        qualifierSetRoot = root;
        qualifierCount = count;
        defaultManifestDigest = qualifierDefaultManifestDigest;
        recoveryEvidenceDigest = recoveryEvidenceDigest_;
        qualifierSetMode = mode;

        emit QualifierSetSealed(root, count, qualifierDefaultManifestDigest, mode, recoveryEvidenceDigest_);
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
        if (manifestDigest == bytes32(0)) revert InvalidManifest();
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
        if (
            !_verifyProof(
                payoutLeaf(recipient.entryDigest, recipient.payoutOrder, recipient.payout),
                recipient.qualifierProof,
                qualifierSetRoot
            )
        ) revert InvalidQualifierProof();
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

    function _requireEoaSigner(bytes32 digest, bytes calldata signature, address expected) internal pure {
        if (_recover(digest, signature) != expected) revert WrongAuthority();
    }

    function _requireResolverSignature(bytes32 digest, bytes calldata signature) internal view {
        (bool ok, bytes memory result) = resolverAuthority.staticcall{gas: RESOLVER_STATICCALL_GAS}(
            abi.encodeWithSelector(IERC1271Resolver.isValidSignature.selector, digest, signature)
        );
        if (!ok || result.length < 32 || abi.decode(result, (bytes4)) != ERC1271_MAGICVALUE) revert WrongAuthority();
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
        return _tokenBalanceOf(address(this));
    }

    function _tokenBalanceOf(address account) internal view returns (uint256 amount) {
        (bool ok, bytes memory data) =
            address(token).staticcall(abi.encodeCall(IERC20ProductionCandidate.balanceOf, (account)));
        if (!ok || data.length < 32) revert TokenTransferFailed();
        amount = abi.decode(data, (uint256));
    }

    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        _callOptionalReturn(abi.encodeCall(IERC20ProductionCandidate.transferFrom, (from, to, amount)));
    }

    function _safeTransfer(address to, uint256 amount) internal {
        uint256 vaultBefore = _tokenBalance();
        uint256 recipientBefore = _tokenBalanceOf(to);

        _callOptionalReturn(abi.encodeCall(IERC20ProductionCandidate.transfer, (to, amount)));

        uint256 vaultAfter = _tokenBalance();
        uint256 recipientAfter = _tokenBalanceOf(to);
        if (
            vaultAfter > vaultBefore || vaultBefore - vaultAfter != amount || recipientAfter < recipientBefore
                || recipientAfter - recipientBefore != amount
        ) revert TokenTransferFailed();
    }

    function _callOptionalReturn(bytes memory callData) internal {
        (bool ok, bytes memory returnData) = address(token).call(callData);
        if (!ok) revert TokenTransferFailed();
        if (returnData.length != 0 && !abi.decode(returnData, (bool))) revert TokenTransferFailed();
    }
}
