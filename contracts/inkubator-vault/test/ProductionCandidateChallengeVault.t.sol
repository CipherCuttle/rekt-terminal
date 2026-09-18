// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {ImmutableResolver1271} from "../src/ImmutableResolver1271.sol";
import {
    IERC20ProductionCandidate,
    ProductionCandidateChallengeVault
} from "../src/ProductionCandidateChallengeVault.sol";

interface VmJ4 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function expectRevert(bytes4 selector) external;
    function warp(uint256 timestamp) external;
}

contract MockProductionToken is IERC20ProductionCandidate {
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    uint256 public transferFromFeeBps;
    address public blockedRecipient;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function setTransferFromFeeBps(uint256 feeBps) external {
        transferFromFeeBps = feeBps;
    }

    function setBlockedRecipient(address recipient) external {
        blockedRecipient = recipient;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        if (to == blockedRecipient) revert("blocked");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        allowance[from][msg.sender] = allowed - amount;

        uint256 fee = amount * transferFromFeeBps / 10_000;
        balanceOf[from] -= amount;
        balanceOf[to] += amount - fee;
        return true;
    }
}

contract ProductionCandidateChallengeVaultTest {
    VmJ4 private constant vm = VmJ4(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant OUTCOME_PK = 0xA11CE;
    uint256 private constant ORGANIZER_PK = 0xB0B;
    uint256 private constant RESOLVER_1_PK = 0xCAFE;
    uint256 private constant RESOLVER_2_PK = 0xD00D;
    uint256 private constant RESOLVER_3_PK = 0xF00D;
    uint256 private constant OUTSIDER_PK = 0xBAD;

    uint256 private constant PRIZE = 250_000_000;

    bytes32 private constant CHALLENGE = keccak256("challenge:stage-j4");
    bytes32 private constant TERMS = keccak256("terms:stage-j4");
    bytes32 private constant BINDING = keccak256("binding:stage-j4");
    bytes32 private constant PREBUILD_MANIFEST = keccak256("manifest:prebuild");
    bytes32 private constant TERMINAL_MANIFEST = keccak256("manifest:terminal");
    bytes32 private constant DEFAULT_MANIFEST = keccak256("manifest:default");
    bytes32 private constant ALT_DEFAULT_MANIFEST = keccak256("manifest:default-alt");
    bytes32 private constant WINNER_MANIFEST = keccak256("manifest:winner");
    bytes32 private constant RECOVERY_EVIDENCE = keccak256("evidence:recovery");

    MockProductionToken private token;
    ImmutableResolver1271 private resolver;
    ProductionCandidateChallengeVault private vault;

    address private outcome;
    address private organizer;
    address private resolver1;
    address private resolver2;
    address private resolver3;
    address private refundRecipient;

    address private alice = address(0xA11C);
    address private bob = address(0xB0B0);
    address private carol = address(0xCA20);

    bytes32 private entryA = bytes32(uint256(1));
    bytes32 private entryB = bytes32(uint256(2));
    bytes32 private entryC = bytes32(uint256(3));

    uint256 private activationDeadline;
    uint256 private organizerDeadline;
    uint256 private resolutionDeadline;
    uint256 private terminalDeadline;

    function setUp() public {
        outcome = vm.addr(OUTCOME_PK);
        organizer = vm.addr(ORGANIZER_PK);
        resolver1 = vm.addr(RESOLVER_1_PK);
        resolver2 = vm.addr(RESOLVER_2_PK);
        resolver3 = vm.addr(RESOLVER_3_PK);
        refundRecipient = address(0xFEE1);

        activationDeadline = block.timestamp + 1 days;
        organizerDeadline = block.timestamp + 7 days;
        resolutionDeadline = organizerDeadline + 72 hours;
        terminalDeadline = organizerDeadline + 30 days;

        token = new MockProductionToken();
        resolver = new ImmutableResolver1271(resolver1, resolver2, resolver3);
        vault = _deploy(token, resolver, PRIZE);

        token.mint(address(this), PRIZE);
        token.approve(address(vault), PRIZE);
        vault.fund();
    }

    function testImmutableResolverRequiresTwoDistinctFrozenSigners() public {
        bytes32 digest = keccak256("resolver-digest");
        bytes memory valid = _resolverSignature(digest, RESOLVER_1_PK, RESOLVER_2_PK);
        _assertEq(vault.resolverAuthority(), address(resolver), "resolver address");
        _assertEq(resolver.quorum(), 2, "resolver quorum");
        _assertEqBytes4(resolver.isValidSignature(digest, valid), resolver.MAGICVALUE(), "2-of-3 signature");

        bytes memory duplicate = _resolverSignature(digest, RESOLVER_1_PK, RESOLVER_1_PK);
        _assertEqBytes4(resolver.isValidSignature(digest, duplicate), resolver.INVALID(), "duplicate signer rejected");

        bytes memory outsider = _resolverSignature(digest, RESOLVER_1_PK, OUTSIDER_PK);
        _assertEqBytes4(resolver.isValidSignature(digest, outsider), resolver.INVALID(), "outsider rejected");
    }

    function testFundingIsExactSingleShotAndFeeOnTransferFails() public {
        _assert(vault.funded(), "vault funded");
        _assertEq(token.balanceOf(address(vault)), PRIZE, "vault balance");

        vm.expectRevert(ProductionCandidateChallengeVault.AlreadyFunded.selector);
        vault.fund();

        MockProductionToken feeToken = new MockProductionToken();
        ProductionCandidateChallengeVault feeVault = _deploy(feeToken, resolver, PRIZE);
        feeToken.mint(address(this), PRIZE);
        feeToken.approve(address(feeVault), PRIZE);
        feeToken.setTransferFromFeeBps(100);

        vm.expectRevert(ProductionCandidateChallengeVault.FundingAmountMismatch.selector);
        feeVault.fund();
    }

    function testConstructorRejectsMutableOrCollidingAuthorityShapeAndBadDeadlines() public {
        ProductionCandidateChallengeVault.VaultConfig memory config = _config(token, resolver, PRIZE);
        config.resolverAuthority = outcome;

        vm.expectRevert(ProductionCandidateChallengeVault.AuthoritiesMustBeIndependent.selector);
        new ProductionCandidateChallengeVault(config);

        config = _config(token, resolver, PRIZE);
        config.resolutionDeadline = config.organizerSelectionDeadline;

        vm.expectRevert(ProductionCandidateChallengeVault.InvalidDeadlines.selector);
        new ProductionCandidateChallengeVault(config);
    }

    function testPreBuildRefundBecomesPermissionlessAtActivationBoundary() public {
        vm.warp(activationDeadline - 1);
        vm.expectRevert(ProductionCandidateChallengeVault.PreBuildRefundNotEligible.selector);
        vault.executePreBuildRefund();

        vm.warp(activationDeadline);
        vault.executePreBuildRefund();

        _assertEq(vault.authorizedManifestDigest(), PREBUILD_MANIFEST, "prebuild manifest");
        _assertEq(
            uint256(vault.authorizedKind()),
            uint256(ProductionCandidateChallengeVault.SettlementKind.REFUND_PRE_BUILD),
            "prebuild kind"
        );
        _assertEq(vault.claimable(refundRecipient), PRIZE, "refund claimable");

        vault.claimFor(refundRecipient);
        _assert(vault.isFinalized(), "prebuild finalized");
    }

    function testActivationBoundaryClosesPayoutSealRace() public {
        (bytes32 root,,,) = _payoutTree();
        bytes32 digest = vault.payoutSetAuthorizationDigest(root, 3);

        vm.warp(activationDeadline);
        vm.expectRevert(ProductionCandidateChallengeVault.ActivationExpired.selector);
        vault.sealPayoutSet(root, 3, _sign(OUTCOME_PK, digest), _sign(ORGANIZER_PK, digest));
    }

    function testSealedPayoutRosterPermanentlyDisablesPreBuildRefund() public {
        _sealPayoutSet();
        vm.warp(activationDeadline);

        vm.expectRevert(ProductionCandidateChallengeVault.PreBuildRefundNotEligible.selector);
        vault.executePreBuildRefund();
    }

    function testQualifierFreezeBindsDefaultManifestIdentity() public {
        (ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers, bytes32 root) = _oneQualifierA();
        _sealPayoutSet();

        bytes32 signedDigest = vault.qualifierSetAuthorizationDigest(
            root,
            1,
            DEFAULT_MANIFEST,
            bytes32(0),
            ProductionCandidateChallengeVault.QualifierSetMode.NORMAL
        );

        vm.expectRevert(ProductionCandidateChallengeVault.WrongAuthority.selector);
        vault.sealQualifierSetNormal(
            qualifiers,
            ALT_DEFAULT_MANIFEST,
            _sign(OUTCOME_PK, signedDigest),
            _sign(ORGANIZER_PK, signedDigest)
        );

        vault.sealQualifierSetNormal(
            qualifiers,
            DEFAULT_MANIFEST,
            _sign(OUTCOME_PK, signedDigest),
            _sign(ORGANIZER_PK, signedDigest)
        );

        _assertEq(vault.defaultManifestDigest(), DEFAULT_MANIFEST, "stored default manifest");
        _assertEq(vault.qualifierSetRoot(), root, "qualifier root");
    }

    function testSignerlessSingleQualifierDefaultUsesStoredManifest() public {
        _sealOneQualifierNormal();

        ProductionCandidateChallengeVault.RecipientClaimInput memory recipient =
            ProductionCandidateChallengeVault.RecipientClaimInput(entryA, 0, alice, PRIZE, new bytes32[](0));

        vm.warp(organizerDeadline - 1);
        vm.expectRevert(ProductionCandidateChallengeVault.DefaultNotEligible.selector);
        vault.executeDefaultSingleQualifier(recipient);

        vm.warp(organizerDeadline);
        vault.executeDefaultSingleQualifier(recipient);

        _assertEq(vault.authorizedManifestDigest(), DEFAULT_MANIFEST, "stored manifest only");
        _assertEq(vault.claimable(alice), PRIZE, "single default credit");
    }

    function testThreeQualifierDefaultUsesCanonicalRemainderAndConserves() public {
        _sealPayoutSet();
        (
            ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers,
            bytes32 root,
            bytes32[] memory proofA,
            bytes32[] memory proofB,
            bytes32[] memory proofC
        ) = _threeQualifiers();

        _sealNormal(qualifiers, root, DEFAULT_MANIFEST);

        uint256 base = PRIZE / 3;
        uint256 remainder = PRIZE % 3;
        ProductionCandidateChallengeVault.RecipientClaimInput[] memory recipients =
            new ProductionCandidateChallengeVault.RecipientClaimInput[](3);
        recipients[0] = ProductionCandidateChallengeVault.RecipientClaimInput(
            entryA, 0, alice, base + (remainder > 0 ? 1 : 0), proofA
        );
        recipients[1] = ProductionCandidateChallengeVault.RecipientClaimInput(
            entryB, 1, bob, base + (remainder > 1 ? 1 : 0), proofB
        );
        recipients[2] = ProductionCandidateChallengeVault.RecipientClaimInput(entryC, 2, carol, base, proofC);

        vm.warp(organizerDeadline);
        vault.executeDefaultDistribution(recipients);

        _assertEq(vault.totalCredited(), PRIZE, "exact credits");
        _assertEq(vault.claimable(alice), 83_333_334, "first canonical remainder");
        _assertEq(vault.claimable(bob), 83_333_333, "second share");
        _assertEq(vault.claimable(carol), 83_333_333, "third share");
        _assertEq(vault.authorizedManifestDigest(), DEFAULT_MANIFEST, "default manifest");
    }

    function testZeroQualifierDefaultRefundIsSignerless() public {
        _sealPayoutSet();
        ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers =
            new ProductionCandidateChallengeVault.PayoutMemberInput[](0);
        bytes32 digest = vault.qualifierSetAuthorizationDigest(
            bytes32(0),
            0,
            DEFAULT_MANIFEST,
            bytes32(0),
            ProductionCandidateChallengeVault.QualifierSetMode.NORMAL
        );
        vault.sealQualifierSetNormal(
            qualifiers,
            DEFAULT_MANIFEST,
            _sign(OUTCOME_PK, digest),
            _sign(ORGANIZER_PK, digest)
        );

        vm.warp(organizerDeadline);
        vault.executeDefaultNoQualifierRefund();

        _assertEq(vault.claimable(refundRecipient), PRIZE, "zero qualifier refund");
        _assertEq(vault.authorizedManifestDigest(), DEFAULT_MANIFEST, "qualifier-bound manifest");
    }

    function testRecoveryQualifierFreezeRequiresBoundaryAndImmutableResolverQuorum() public {
        _sealPayoutSet();
        (ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers, bytes32 root) = _oneQualifierA();

        bytes32 digest = vault.qualifierSetAuthorizationDigest(
            root,
            1,
            DEFAULT_MANIFEST,
            RECOVERY_EVIDENCE,
            ProductionCandidateChallengeVault.QualifierSetMode.RECOVERY
        );

        vm.warp(resolutionDeadline - 1);
        vm.expectRevert(ProductionCandidateChallengeVault.RecoveryNotEligible.selector);
        vault.sealQualifierSetRecovery(
            qualifiers,
            DEFAULT_MANIFEST,
            RECOVERY_EVIDENCE,
            _resolverSignature(digest, RESOLVER_1_PK, RESOLVER_2_PK)
        );

        vm.warp(resolutionDeadline);
        vm.expectRevert(ProductionCandidateChallengeVault.WrongAuthority.selector);
        vault.sealQualifierSetRecovery(
            qualifiers,
            DEFAULT_MANIFEST,
            RECOVERY_EVIDENCE,
            _resolverSignature(digest, RESOLVER_1_PK, RESOLVER_1_PK)
        );

        vault.sealQualifierSetRecovery(
            qualifiers,
            DEFAULT_MANIFEST,
            RECOVERY_EVIDENCE,
            _resolverSignature(digest, RESOLVER_1_PK, RESOLVER_2_PK)
        );

        _assertEq(
            uint256(vault.qualifierSetMode()),
            uint256(ProductionCandidateChallengeVault.QualifierSetMode.RECOVERY),
            "recovery mode"
        );
        _assertEq(vault.recoveryEvidenceDigest(), RECOVERY_EVIDENCE, "recovery evidence");

        ProductionCandidateChallengeVault.RecipientClaimInput memory recipient =
            ProductionCandidateChallengeVault.RecipientClaimInput(entryA, 0, alice, PRIZE, new bytes32[](0));
        vault.executeDefaultSingleQualifier(recipient);
        _assertEq(vault.claimable(alice), PRIZE, "recovered qualifier default");
    }

    function testRecoveryClosesAtTerminalBoundary() public {
        _sealPayoutSet();
        (ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers, bytes32 root) = _oneQualifierA();
        bytes32 digest = vault.qualifierSetAuthorizationDigest(
            root,
            1,
            DEFAULT_MANIFEST,
            RECOVERY_EVIDENCE,
            ProductionCandidateChallengeVault.QualifierSetMode.RECOVERY
        );

        vm.warp(terminalDeadline);
        vm.expectRevert(ProductionCandidateChallengeVault.RecoveryNotEligible.selector);
        vault.sealQualifierSetRecovery(
            qualifiers,
            DEFAULT_MANIFEST,
            RECOVERY_EVIDENCE,
            _resolverSignature(digest, RESOLVER_1_PK, RESOLVER_2_PK)
        );
    }

    function testTerminalRefundNeedsSealedPayoutRosterToPreventManifestAmbiguity() public {
        vm.warp(terminalDeadline);
        vm.expectRevert(ProductionCandidateChallengeVault.TerminalNotEligible.selector);
        vault.executeTerminalRefund();

        vault.executePreBuildRefund();
        _assertEq(vault.authorizedManifestDigest(), PREBUILD_MANIFEST, "unactivated challenge stays prebuild");
    }

    function testTerminalRefundIsPermissionlessAfterLongStopWhenQualificationNeverFroze() public {
        _sealPayoutSet();

        vm.warp(terminalDeadline - 1);
        vm.expectRevert(ProductionCandidateChallengeVault.TerminalNotEligible.selector);
        vault.executeTerminalRefund();

        vm.warp(terminalDeadline);
        vault.executeTerminalRefund();

        _assertEq(vault.authorizedManifestDigest(), TERMINAL_MANIFEST, "terminal manifest");
        _assertEq(vault.claimable(refundRecipient), PRIZE, "terminal refund");
    }

    function testOrganizerWinnerRequiresFrozenQualifierAndBothIndependentAuthorities() public {
        _sealOneQualifierNormal();

        ProductionCandidateChallengeVault.RecipientClaimInput memory recipient =
            ProductionCandidateChallengeVault.RecipientClaimInput(entryA, 0, alice, PRIZE, new bytes32[](0));
        bytes32 recipientsDigest = vault.singleRecipientDigest(entryA, 0, alice, PRIZE);
        bytes32 digest = vault.settlementAuthorizationDigest(
            WINNER_MANIFEST,
            vault.qualifierSetRoot(),
            ProductionCandidateChallengeVault.SettlementKind.ORGANIZER_WINNER,
            recipientsDigest
        );

        vm.expectRevert(ProductionCandidateChallengeVault.WrongAuthority.selector);
        vault.authorizeOrganizerWinner(
            WINNER_MANIFEST,
            recipient,
            _sign(OUTCOME_PK, digest),
            _sign(OUTCOME_PK, digest)
        );

        vault.authorizeOrganizerWinner(
            WINNER_MANIFEST,
            recipient,
            _sign(OUTCOME_PK, digest),
            _sign(ORGANIZER_PK, digest)
        );
        _assertEq(vault.claimable(alice), PRIZE, "winner claimable");
    }

    function testBlockedRecipientCannotBlockOtherClaims() public {
        _sealPayoutSet();
        (
            ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers,
            bytes32 root,
            bytes32[] memory proofA,
            bytes32[] memory proofB
        ) = _twoQualifiers();
        _sealNormal(qualifiers, root, DEFAULT_MANIFEST);

        uint256 base = PRIZE / 2;
        ProductionCandidateChallengeVault.RecipientClaimInput[] memory recipients =
            new ProductionCandidateChallengeVault.RecipientClaimInput[](2);
        recipients[0] = ProductionCandidateChallengeVault.RecipientClaimInput(entryA, 0, alice, base, proofA);
        recipients[1] = ProductionCandidateChallengeVault.RecipientClaimInput(entryB, 1, bob, base, proofB);

        vm.warp(organizerDeadline);
        vault.executeDefaultDistribution(recipients);

        token.setBlockedRecipient(alice);
        vm.expectRevert(ProductionCandidateChallengeVault.TokenTransferFailed.selector);
        vault.claimFor(alice);

        _assertEq(vault.claimable(alice), base, "failed claim remains owed");
        vault.claimFor(bob);
        _assertEq(token.balanceOf(bob), base, "other recipient claims");
        _assertEq(vault.totalClaimed(), base, "only successful claim counted");
    }

    function _deploy(MockProductionToken token_, ImmutableResolver1271 resolver_, uint256 amount)
        internal
        returns (ProductionCandidateChallengeVault)
    {
        return new ProductionCandidateChallengeVault(_config(token_, resolver_, amount));
    }

    function _config(MockProductionToken token_, ImmutableResolver1271 resolver_, uint256 amount)
        internal
        view
        returns (ProductionCandidateChallengeVault.VaultConfig memory)
    {
        return ProductionCandidateChallengeVault.VaultConfig({
            token: token_,
            challengeDigest: CHALLENGE,
            termsDigest: TERMS,
            bindingDigest: BINDING,
            prizeAmount: amount,
            activationDeadline: activationDeadline,
            organizerSelectionDeadline: organizerDeadline,
            resolutionDeadline: resolutionDeadline,
            terminalLongStop: terminalDeadline,
            refundRecipient: refundRecipient,
            outcomeAuthority: outcome,
            organizerSelectionAuthority: organizer,
            resolverAuthority: address(resolver_),
            preBuildRefundManifestDigest: PREBUILD_MANIFEST,
            terminalRefundManifestDigest: TERMINAL_MANIFEST
        });
    }

    function _sealPayoutSet() internal {
        (bytes32 root,,,) = _payoutTree();
        bytes32 digest = vault.payoutSetAuthorizationDigest(root, 3);
        vault.sealPayoutSet(root, 3, _sign(OUTCOME_PK, digest), _sign(ORGANIZER_PK, digest));
    }

    function _sealOneQualifierNormal() internal {
        _sealPayoutSet();
        (ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers, bytes32 root) = _oneQualifierA();
        _sealNormal(qualifiers, root, DEFAULT_MANIFEST);
    }

    function _sealNormal(
        ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers,
        bytes32 root,
        bytes32 manifest
    ) internal {
        bytes32 digest = vault.qualifierSetAuthorizationDigest(
            root,
            uint16(qualifiers.length),
            manifest,
            bytes32(0),
            ProductionCandidateChallengeVault.QualifierSetMode.NORMAL
        );
        vault.sealQualifierSetNormal(
            qualifiers,
            manifest,
            _sign(OUTCOME_PK, digest),
            _sign(ORGANIZER_PK, digest)
        );
    }

    function _oneQualifierA()
        internal
        view
        returns (ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers, bytes32 root)
    {
        (, bytes32[] memory payoutProofA,,) = _payoutTree();
        qualifiers = new ProductionCandidateChallengeVault.PayoutMemberInput[](1);
        qualifiers[0] = ProductionCandidateChallengeVault.PayoutMemberInput(entryA, 0, alice, payoutProofA);
        root = vault.payoutLeaf(entryA, 0, alice);
    }

    function _twoQualifiers()
        internal
        view
        returns (
            ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers,
            bytes32 root,
            bytes32[] memory proofA,
            bytes32[] memory proofB
        )
    {
        (, bytes32[] memory payoutProofA, bytes32[] memory payoutProofB,) = _payoutTree();
        qualifiers = new ProductionCandidateChallengeVault.PayoutMemberInput[](2);
        qualifiers[0] = ProductionCandidateChallengeVault.PayoutMemberInput(entryA, 0, alice, payoutProofA);
        qualifiers[1] = ProductionCandidateChallengeVault.PayoutMemberInput(entryB, 1, bob, payoutProofB);

        bytes32 leafA = vault.payoutLeaf(entryA, 0, alice);
        bytes32 leafB = vault.payoutLeaf(entryB, 1, bob);
        root = vault.merklePair(leafA, leafB);

        proofA = new bytes32[](1);
        proofA[0] = leafB;
        proofB = new bytes32[](1);
        proofB[0] = leafA;
    }

    function _threeQualifiers()
        internal
        view
        returns (
            ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers,
            bytes32 root,
            bytes32[] memory proofA,
            bytes32[] memory proofB,
            bytes32[] memory proofC
        )
    {
        (root, proofA, proofB, proofC) = _payoutTree();
        qualifiers = new ProductionCandidateChallengeVault.PayoutMemberInput[](3);
        qualifiers[0] = ProductionCandidateChallengeVault.PayoutMemberInput(entryA, 0, alice, proofA);
        qualifiers[1] = ProductionCandidateChallengeVault.PayoutMemberInput(entryB, 1, bob, proofB);
        qualifiers[2] = ProductionCandidateChallengeVault.PayoutMemberInput(entryC, 2, carol, proofC);
    }

    function _payoutTree()
        internal
        view
        returns (bytes32 root, bytes32[] memory proofA, bytes32[] memory proofB, bytes32[] memory proofC)
    {
        bytes32 leafA = vault.payoutLeaf(entryA, 0, alice);
        bytes32 leafB = vault.payoutLeaf(entryB, 1, bob);
        bytes32 leafC = vault.payoutLeaf(entryC, 2, carol);

        bytes32 branchAB = vault.merklePair(leafA, leafB);
        bytes32 branchCC = vault.merklePair(leafC, leafC);
        root = vault.merklePair(branchAB, branchCC);

        proofA = new bytes32[](2);
        proofA[0] = leafB;
        proofA[1] = branchCC;

        proofB = new bytes32[](2);
        proofB[0] = leafA;
        proofB[1] = branchCC;

        proofC = new bytes32[](2);
        proofC[0] = leafC;
        proofC[1] = branchAB;
    }

    function _resolverSignature(bytes32 digest, uint256 firstPk, uint256 secondPk)
        internal
        returns (bytes memory)
    {
        return bytes.concat(_sign(firstPk, digest), _sign(secondPk, digest));
    }

    function _sign(uint256 privateKey, bytes32 digest) internal returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _assert(bool condition, string memory message) internal pure {
        require(condition, message);
    }

    function _assertEq(uint256 left, uint256 right, string memory message) internal pure {
        require(left == right, message);
    }

    function _assertEq(address left, address right, string memory message) internal pure {
        require(left == right, message);
    }

    function _assertEq(bytes32 left, bytes32 right, string memory message) internal pure {
        require(left == right, message);
    }

    function _assertEqBytes4(bytes4 left, bytes4 right, string memory message) internal pure {
        require(left == right, message);
    }
}
