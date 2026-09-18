// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {ImmutableResolver1271} from "../src/ImmutableResolver1271.sol";
import {
    IERC20ProductionCandidate,
    ProductionCandidateChallengeVault
} from "../src/ProductionCandidateChallengeVault.sol";

interface VmJ4Matrix {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function expectRevert() external;
    function expectRevert(bytes4 selector) external;
    function warp(uint256 timestamp) external;
    function chainId(uint256 newChainId) external;
}

contract MatrixToken is IERC20ProductionCandidate {
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public paused;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function setPaused(bool value) external {
        paused = value;
    }

    function transfer(address to, uint256 amount) external virtual override returns (bool) {
        require(!paused, "paused");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external virtual override returns (bool) {
        require(!paused, "paused");
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract NoReturnMatrixToken is MatrixToken {
    function transfer(address to, uint256 amount) external override returns (bool) {
        require(!paused, "paused");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        assembly ("memory-safe") {
            return(0, 0)
        }
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        require(!paused, "paused");
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        assembly ("memory-safe") {
            return(0, 0)
        }
    }
}

contract ReentrantMatrixToken is MatrixToken {
    address public reentryTarget;
    address public reentryRecipient;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    function configureReentry(address target, address recipient) external {
        reentryTarget = target;
        reentryRecipient = recipient;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        if (reentryTarget != address(0) && !reentryAttempted) {
            reentryAttempted = true;
            (reentrySucceeded,) =
                reentryTarget.call(abi.encodeWithSignature("claimFor(address)", reentryRecipient));
        }

        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract WrongMagicResolver {
    function isValidSignature(bytes32, bytes calldata) external pure returns (bytes4) {
        return 0xffffffff;
    }
}

contract RevertingResolver {
    function isValidSignature(bytes32, bytes calldata) external pure returns (bytes4) {
        revert("resolver-revert");
    }
}

contract ShortReturnResolver {
    fallback() external {
        assembly ("memory-safe") {
            mstore(0, 0x1626ba7e)
            return(28, 4)
        }
    }
}

contract ProductionCandidatePreAuditMatrixTest {
    VmJ4Matrix private constant vm = VmJ4Matrix(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant OUTCOME_PK = 0xA11CE;
    uint256 private constant ORGANIZER_PK = 0xB0B;
    uint256 private constant RESOLVER_1_PK = 0xCAFE;
    uint256 private constant RESOLVER_2_PK = 0xD00D;
    uint256 private constant RESOLVER_3_PK = 0xF00D;
    uint256 private constant OUTSIDER_PK = 0xBAD;

    uint256 private constant SECP256K1N =
        0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141;

    bytes32 private constant CHALLENGE = keccak256("challenge:j4-preaudit");
    bytes32 private constant TERMS = keccak256("terms:j4-preaudit");
    bytes32 private constant BINDING = keccak256("binding:j4-preaudit");
    bytes32 private constant DEFAULT_MANIFEST = keccak256("manifest:j4-default");
    bytes32 private constant PREBUILD_MANIFEST = keccak256("manifest:j4-prebuild");
    bytes32 private constant TERMINAL_MANIFEST = keccak256("manifest:j4-terminal");
    bytes32 private constant RECOVERY_EVIDENCE = keccak256("evidence:j4-recovery");

    bytes32 private constant ENTRY_A = bytes32(uint256(1));
    bytes32 private constant ENTRY_B = bytes32(uint256(2));
    bytes32 private constant ENTRY_C = bytes32(uint256(3));

    address private constant ALICE = address(0xA11C);
    address private constant BOB = address(0xB0B0);
    address private constant CAROL = address(0xCA20);
    address private constant REFUND = address(0xFEE1);

    address private outcome;
    address private organizer;
    address private resolver1;
    address private resolver2;
    address private resolver3;

    ImmutableResolver1271 private resolver;

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

        activationDeadline = block.timestamp + 1 days;
        organizerDeadline = block.timestamp + 7 days;
        resolutionDeadline = organizerDeadline + 72 hours;
        terminalDeadline = organizerDeadline + 30 days;

        resolver = new ImmutableResolver1271(resolver1, resolver2, resolver3);
    }

    function testPreResolutionRecoveryRequiresOutcomeAndResolverAndFreezesOnce() public {
        MatrixToken token = new MatrixToken();
        ProductionCandidateChallengeVault vault = _deployAndFund(token, address(resolver), 100);
        _sealSinglePayout(vault);

        ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers = _singleQualifier();
        bytes32 root = vault.payoutLeaf(ENTRY_A, 0, ALICE);
        bytes32 digest = vault.qualifierSetAuthorizationDigest(
            root,
            1,
            DEFAULT_MANIFEST,
            RECOVERY_EVIDENCE,
            ProductionCandidateChallengeVault.QualifierSetMode.RECOVERY
        );

        vm.warp(organizerDeadline);

        vm.expectRevert(ProductionCandidateChallengeVault.WrongAuthority.selector);
        vault.sealQualifierSetRecoveryCoSigned(
            qualifiers,
            DEFAULT_MANIFEST,
            RECOVERY_EVIDENCE,
            _sign(OUTSIDER_PK, digest),
            _resolverSignature(digest, RESOLVER_1_PK, RESOLVER_2_PK)
        );

        vault.sealQualifierSetRecoveryCoSigned(
            qualifiers,
            DEFAULT_MANIFEST,
            RECOVERY_EVIDENCE,
            _sign(OUTCOME_PK, digest),
            _resolverSignature(digest, RESOLVER_1_PK, RESOLVER_2_PK)
        );

        _assert(vault.qualificationResolved(), "recovery must resolve qualification");
        _assertEq(vault.qualifierSetRoot(), root, "recovery root");
        _assertEq(vault.defaultManifestDigest(), DEFAULT_MANIFEST, "recovery default manifest");
        _assertEq(vault.recoveryEvidenceDigest(), RECOVERY_EVIDENCE, "recovery evidence");

        vm.expectRevert(ProductionCandidateChallengeVault.QualificationAlreadyResolved.selector);
        vault.sealQualifierSetRecoveryCoSigned(
            qualifiers,
            DEFAULT_MANIFEST,
            RECOVERY_EVIDENCE,
            _sign(OUTCOME_PK, digest),
            _resolverSignature(digest, RESOLVER_1_PK, RESOLVER_2_PK)
        );
    }

    function testPreResolutionResolverOnlyPathRejects() public {
        MatrixToken token = new MatrixToken();
        ProductionCandidateChallengeVault vault = _deployAndFund(token, address(resolver), 100);
        _sealSinglePayout(vault);

        ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers = _singleQualifier();
        bytes32 root = vault.payoutLeaf(ENTRY_A, 0, ALICE);
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
    }

    function testPayoutSignatureCannotReplayAcrossVaults() public {
        MatrixToken tokenA = new MatrixToken();
        MatrixToken tokenB = new MatrixToken();
        ProductionCandidateChallengeVault vaultA = _deployAndFund(tokenA, address(resolver), 100);
        ProductionCandidateChallengeVault vaultB = _deployAndFund(tokenB, address(resolver), 100);

        bytes32 root = vaultA.payoutLeaf(ENTRY_A, 0, ALICE);
        bytes32 digestA = vaultA.payoutSetAuthorizationDigest(root, 1);
        bytes memory outcomeSig = _sign(OUTCOME_PK, digestA);
        bytes memory organizerSig = _sign(ORGANIZER_PK, digestA);

        vaultA.sealPayoutSet(root, 1, outcomeSig, organizerSig);

        vm.expectRevert(ProductionCandidateChallengeVault.WrongAuthority.selector);
        vaultB.sealPayoutSet(root, 1, outcomeSig, organizerSig);
    }

    function testPayoutSignatureCannotReplayAcrossChainIds() public {
        MatrixToken token = new MatrixToken();
        ProductionCandidateChallengeVault vault = _deployAndFund(token, address(resolver), 100);

        bytes32 root = vault.payoutLeaf(ENTRY_A, 0, ALICE);
        bytes32 digest = vault.payoutSetAuthorizationDigest(root, 1);
        bytes memory outcomeSig = _sign(OUTCOME_PK, digest);
        bytes memory organizerSig = _sign(ORGANIZER_PK, digest);

        vm.chainId(block.chainid + 1);
        vm.expectRevert(ProductionCandidateChallengeVault.WrongAuthority.selector);
        vault.sealPayoutSet(root, 1, outcomeSig, organizerSig);
    }

    function testEcdsaRejectsHighSBadVMalformedAndZeroRecovery() public {
        MatrixToken token = new MatrixToken();
        ProductionCandidateChallengeVault vault = _deployAndFund(token, address(resolver), 100);

        bytes32 root = vault.payoutLeaf(ENTRY_A, 0, ALICE);
        bytes32 digest = vault.payoutSetAuthorizationDigest(root, 1);
        bytes memory validOutcome = _sign(OUTCOME_PK, digest);
        bytes memory validOrganizer = _sign(ORGANIZER_PK, digest);

        vm.expectRevert(ProductionCandidateChallengeVault.InvalidSignature.selector);
        vault.sealPayoutSet(root, 1, _highSSignature(validOutcome), validOrganizer);

        bytes memory badV = _copy(validOutcome);
        badV[64] = bytes1(uint8(29));
        vm.expectRevert(ProductionCandidateChallengeVault.InvalidSignature.selector);
        vault.sealPayoutSet(root, 1, badV, validOrganizer);

        vm.expectRevert(ProductionCandidateChallengeVault.InvalidSignature.selector);
        vault.sealPayoutSet(root, 1, hex"1234", validOrganizer);

        bytes memory zeroRecovery = abi.encodePacked(bytes32(0), bytes32(0), uint8(27));
        vm.expectRevert(ProductionCandidateChallengeVault.InvalidSignature.selector);
        vault.sealPayoutSet(root, 1, zeroRecovery, validOrganizer);
    }

    function testErc1271WrongMagicFailsClosed() public {
        _assertHostileResolverRejects(address(new WrongMagicResolver()));
    }

    function testErc1271RevertFailsClosed() public {
        _assertHostileResolverRejects(address(new RevertingResolver()));
    }

    function testErc1271ShortReturnFailsClosed() public {
        _assertHostileResolverRejects(address(new ShortReturnResolver()));
    }

    function testErc1271ValidSignatureForWrongResolverSetFailsClosed() public {
        uint256 wrong1Pk = 0x1111;
        uint256 wrong2Pk = 0x2222;
        ImmutableResolver1271 wrongResolver =
            new ImmutableResolver1271(vm.addr(wrong1Pk), vm.addr(wrong2Pk), vm.addr(0x3333));

        MatrixToken token = new MatrixToken();
        ProductionCandidateChallengeVault vault = _deployAndFund(token, address(resolver), 100);
        _sealSinglePayout(vault);

        ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers = _singleQualifier();
        bytes32 root = vault.payoutLeaf(ENTRY_A, 0, ALICE);
        bytes32 digest = vault.qualifierSetAuthorizationDigest(
            root,
            1,
            DEFAULT_MANIFEST,
            RECOVERY_EVIDENCE,
            ProductionCandidateChallengeVault.QualifierSetMode.RECOVERY
        );
        bytes memory wrongAuthoritySignature =
            _resolverSignature(digest, wrong1Pk, wrong2Pk);

        require(
            wrongResolver.isValidSignature(digest, wrongAuthoritySignature) == wrongResolver.MAGICVALUE(),
            "control signature must be valid for wrong resolver"
        );

        vm.warp(resolutionDeadline);
        vm.expectRevert(ProductionCandidateChallengeVault.WrongAuthority.selector);
        vault.sealQualifierSetRecovery(
            qualifiers,
            DEFAULT_MANIFEST,
            RECOVERY_EVIDENCE,
            wrongAuthoritySignature
        );
    }

    function testResolverQuorumSurvivesLossOfAnyOneSigner() public {
        bytes32 digest = keccak256("j4-resolver-one-signer-loss");
        bytes memory signers23 = _resolverSignature(digest, RESOLVER_2_PK, RESOLVER_3_PK);
        require(
            resolver.isValidSignature(digest, signers23) == resolver.MAGICVALUE(),
            "remaining two immutable signers must retain quorum"
        );
    }

    function testNoReturnTokenExactDeliveryMatchesSupportedWrapperPolicy() public {
        NoReturnMatrixToken token = new NoReturnMatrixToken();
        ProductionCandidateChallengeVault vault = _deployAndFund(token, address(resolver), 100);
        _sealSinglePayout(vault);
        _sealSingleQualifierNormal(vault);

        ProductionCandidateChallengeVault.RecipientClaimInput memory recipient =
            ProductionCandidateChallengeVault.RecipientClaimInput(ENTRY_A, 0, ALICE, 100, new bytes32[](0));

        vm.warp(organizerDeadline);
        vault.executeDefaultSingleQualifier(recipient);
        vault.claimFor(ALICE);

        _assertEq(token.balanceOf(ALICE), 100, "no-return exact token delivers");
        _assert(vault.isFinalized(), "no-return exact token finalizes");
    }

    function testPausedTokenLeavesClaimRecoverableAfterUnpause() public {
        MatrixToken token = new MatrixToken();
        ProductionCandidateChallengeVault vault = _deployAndFund(token, address(resolver), 100);
        _sealSinglePayout(vault);
        _sealSingleQualifierNormal(vault);

        ProductionCandidateChallengeVault.RecipientClaimInput memory recipient =
            ProductionCandidateChallengeVault.RecipientClaimInput(ENTRY_A, 0, ALICE, 100, new bytes32[](0));

        vm.warp(organizerDeadline);
        vault.executeDefaultSingleQualifier(recipient);

        token.setPaused(true);
        vm.expectRevert(ProductionCandidateChallengeVault.TokenTransferFailed.selector);
        vault.claimFor(ALICE);
        _assertEq(vault.claimable(ALICE), 100, "paused claim remains recoverable");
        _assertEq(vault.totalClaimed(), 0, "paused claim not counted");

        token.setPaused(false);
        vault.claimFor(ALICE);
        _assertEq(token.balanceOf(ALICE), 100, "claim succeeds after unpause");
        _assert(vault.isFinalized(), "unpaused recovery finalizes");
    }

    function testReentrantTokenCannotDoubleClaim() public {
        ReentrantMatrixToken token = new ReentrantMatrixToken();
        ProductionCandidateChallengeVault vault = _deployAndFund(token, address(resolver), 100);
        _sealSinglePayout(vault);
        _sealSingleQualifierNormal(vault);

        ProductionCandidateChallengeVault.RecipientClaimInput memory recipient =
            ProductionCandidateChallengeVault.RecipientClaimInput(ENTRY_A, 0, ALICE, 100, new bytes32[](0));

        vm.warp(organizerDeadline);
        vault.executeDefaultSingleQualifier(recipient);

        token.configureReentry(address(vault), ALICE);
        vault.claimFor(ALICE);

        _assert(token.reentryAttempted(), "token must attempt reentry");
        _assert(!token.reentrySucceeded(), "reentry must fail");
        _assertEq(vault.totalClaimed(), 100, "claim counted once");
        _assertEq(vault.claimable(ALICE), 0, "claimable consumed once");
        _assertEq(token.balanceOf(ALICE), 100, "recipient receives exact claim");
        _assert(vault.isFinalized(), "single exact claim finalizes");
    }

    function testConstructorReadbackMatchesFrozenPlan() public {
        MatrixToken token = new MatrixToken();
        ProductionCandidateChallengeVault vault = _deployAndFund(token, address(resolver), 123_456);

        _assertEq(address(vault.token()), address(token), "token readback");
        _assertEq(vault.challengeDigest(), CHALLENGE, "challenge readback");
        _assertEq(vault.termsDigest(), TERMS, "terms readback");
        _assertEq(vault.bindingDigest(), BINDING, "binding readback");
        _assertEq(vault.prizeAmount(), 123_456, "prize readback");
        _assertEq(vault.activationDeadline(), activationDeadline, "activation readback");
        _assertEq(vault.organizerSelectionDeadline(), organizerDeadline, "organizer deadline readback");
        _assertEq(vault.resolutionDeadline(), resolutionDeadline, "resolution readback");
        _assertEq(vault.terminalLongStop(), terminalDeadline, "terminal readback");
        _assertEq(vault.refundRecipient(), REFUND, "refund readback");
        _assertEq(vault.outcomeAuthority(), outcome, "outcome readback");
        _assertEq(vault.organizerSelectionAuthority(), organizer, "organizer readback");
        _assertEq(vault.resolverAuthority(), address(resolver), "resolver readback");
        _assertEq(vault.preBuildRefundManifestDigest(), PREBUILD_MANIFEST, "prebuild manifest readback");
        _assertEq(vault.terminalRefundManifestDigest(), TERMINAL_MANIFEST, "terminal manifest readback");
    }

    function testFuzzSingleQualifierConservation(uint96 rawPrize) public {
        uint256 prize = uint256(rawPrize) + 1;
        MatrixToken token = new MatrixToken();
        ProductionCandidateChallengeVault vault = _deployAndFund(token, address(resolver), prize);
        _sealSinglePayout(vault);
        _sealSingleQualifierNormal(vault);

        ProductionCandidateChallengeVault.RecipientClaimInput memory recipient =
            ProductionCandidateChallengeVault.RecipientClaimInput(ENTRY_A, 0, ALICE, prize, new bytes32[](0));

        vm.warp(organizerDeadline);
        vault.executeDefaultSingleQualifier(recipient);

        _assertEq(vault.totalCredited(), prize, "credits equal prize");
        _assertEq(vault.totalClaimed(), 0, "nothing claimed before claim");
        _assertEq(vault.claimable(ALICE), prize, "claimable conservation");
        _assert(!vault.isFinalized(), "not finalized before claim");

        vault.claimFor(ALICE);

        _assertEq(vault.totalClaimed(), prize, "claimed equals prize");
        _assertEq(vault.remainingLiability(), 0, "zero remaining liability");
        _assert(vault.totalClaimed() <= vault.prizeAmount(), "claimed never exceeds prize");
        _assert(vault.isFinalized(), "finalized iff exact prize claimed");
    }

    function testFuzzThreeQualifierDistributionConservesAndUsesCanonicalRemainder(uint96 rawPrize) public {
        uint256 prize = uint256(rawPrize) + 3;
        MatrixToken token = new MatrixToken();
        ProductionCandidateChallengeVault vault = _deployAndFund(token, address(resolver), prize);

        (bytes32 root, bytes32[] memory proofA, bytes32[] memory proofB, bytes32[] memory proofC) =
            _threeLeafTree(vault);
        _sealPayout(vault, root, 3);

        ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers =
            new ProductionCandidateChallengeVault.PayoutMemberInput[](3);
        qualifiers[0] = ProductionCandidateChallengeVault.PayoutMemberInput(ENTRY_A, 0, ALICE, proofA);
        qualifiers[1] = ProductionCandidateChallengeVault.PayoutMemberInput(ENTRY_B, 1, BOB, proofB);
        qualifiers[2] = ProductionCandidateChallengeVault.PayoutMemberInput(ENTRY_C, 2, CAROL, proofC);
        _sealNormal(vault, qualifiers, root);

        uint256 base = prize / 3;
        uint256 remainder = prize % 3;

        ProductionCandidateChallengeVault.RecipientClaimInput[] memory recipients =
            new ProductionCandidateChallengeVault.RecipientClaimInput[](3);
        recipients[0] = ProductionCandidateChallengeVault.RecipientClaimInput(
            ENTRY_A, 0, ALICE, base + (remainder > 0 ? 1 : 0), proofA
        );
        recipients[1] = ProductionCandidateChallengeVault.RecipientClaimInput(
            ENTRY_B, 1, BOB, base + (remainder > 1 ? 1 : 0), proofB
        );
        recipients[2] = ProductionCandidateChallengeVault.RecipientClaimInput(ENTRY_C, 2, CAROL, base, proofC);

        vm.warp(organizerDeadline);
        vault.executeDefaultDistribution(recipients);

        uint256 claimableSum = vault.claimable(ALICE) + vault.claimable(BOB) + vault.claimable(CAROL);
        _assertEq(claimableSum, prize, "claimable sum equals prize");
        _assertEq(vault.totalCredited(), prize, "credited equals prize");

        vault.claimFor(BOB);
        vault.claimFor(ALICE);
        vault.claimFor(CAROL);

        _assertEq(vault.totalClaimed(), prize, "claimed sum equals prize");
        _assert(vault.totalClaimed() <= vault.prizeAmount(), "claimed bounded by prize");
        _assert(vault.isFinalized(), "distribution finalizes exactly");
    }

    function testConstructorRejectsZeroCoreIdentityAndPrize() public {
        MatrixToken token = new MatrixToken();
        ProductionCandidateChallengeVault.VaultConfig memory config = _config(token, address(resolver), 100);

        config.token = IERC20ProductionCandidate(address(0));
        vm.expectRevert(ProductionCandidateChallengeVault.ZeroAddress.selector);
        new ProductionCandidateChallengeVault(config);

        config = _config(token, address(resolver), 100);
        config.refundRecipient = address(0);
        vm.expectRevert(ProductionCandidateChallengeVault.ZeroAddress.selector);
        new ProductionCandidateChallengeVault(config);

        config = _config(token, address(resolver), 100);
        config.challengeDigest = bytes32(0);
        vm.expectRevert(ProductionCandidateChallengeVault.ZeroDigest.selector);
        new ProductionCandidateChallengeVault(config);

        config = _config(token, address(resolver), 100);
        config.termsDigest = bytes32(0);
        vm.expectRevert(ProductionCandidateChallengeVault.ZeroDigest.selector);
        new ProductionCandidateChallengeVault(config);

        config = _config(token, address(resolver), 100);
        config.bindingDigest = bytes32(0);
        vm.expectRevert(ProductionCandidateChallengeVault.ZeroDigest.selector);
        new ProductionCandidateChallengeVault(config);

        config = _config(token, address(resolver), 0);
        vm.expectRevert(ProductionCandidateChallengeVault.InvalidPrizeAmount.selector);
        new ProductionCandidateChallengeVault(config);
    }

    function testUnsolicitedDustCannotSatisfyOrChangeFundingLiability() public {
        MatrixToken token = new MatrixToken();
        ProductionCandidateChallengeVault vault =
            new ProductionCandidateChallengeVault(_config(token, address(resolver), 100));

        token.mint(address(vault), 7);
        token.mint(address(this), 100);
        token.approve(address(vault), 100);
        vault.fund();

        _assert(vault.funded(), "funding must still require exact transfer");
        _assertEq(token.balanceOf(address(vault)), 107, "dust remains surplus");
        _assertEq(vault.remainingLiability(), 100, "liability remains exact prize");
    }

    function testPayoutSealRejectsWrongCoAuthorityAndCannotReseal() public {
        MatrixToken token = new MatrixToken();
        ProductionCandidateChallengeVault vault = _deployAndFund(token, address(resolver), 100);

        bytes32 root = vault.payoutLeaf(ENTRY_A, 0, ALICE);
        bytes32 digest = vault.payoutSetAuthorizationDigest(root, 1);

        vm.expectRevert(ProductionCandidateChallengeVault.WrongAuthority.selector);
        vault.sealPayoutSet(root, 1, _sign(OUTCOME_PK, digest), _sign(OUTCOME_PK, digest));

        vault.sealPayoutSet(root, 1, _sign(OUTCOME_PK, digest), _sign(ORGANIZER_PK, digest));

        vm.expectRevert(ProductionCandidateChallengeVault.PayoutSetAlreadySealed.selector);
        vault.sealPayoutSet(root, 1, _sign(OUTCOME_PK, digest), _sign(ORGANIZER_PK, digest));
    }

    function testRecoveryEvidenceAndManifestMutationInvalidateAuthorization() public {
        MatrixToken token = new MatrixToken();
        ProductionCandidateChallengeVault vault = _deployAndFund(token, address(resolver), 100);
        _sealSinglePayout(vault);

        ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers = _singleQualifier();
        bytes32 root = vault.payoutLeaf(ENTRY_A, 0, ALICE);
        bytes32 digest = vault.qualifierSetAuthorizationDigest(
            root,
            1,
            DEFAULT_MANIFEST,
            RECOVERY_EVIDENCE,
            ProductionCandidateChallengeVault.QualifierSetMode.RECOVERY
        );
        bytes memory outcomeSig = _sign(OUTCOME_PK, digest);
        bytes memory resolverSig = _resolverSignature(digest, RESOLVER_1_PK, RESOLVER_2_PK);

        vm.warp(organizerDeadline);

        vm.expectRevert(ProductionCandidateChallengeVault.WrongAuthority.selector);
        vault.sealQualifierSetRecoveryCoSigned(
            qualifiers,
            DEFAULT_MANIFEST,
            keccak256("mutated-evidence"),
            outcomeSig,
            resolverSig
        );

        vm.expectRevert(ProductionCandidateChallengeVault.WrongAuthority.selector);
        vault.sealQualifierSetRecoveryCoSigned(
            qualifiers,
            keccak256("mutated-manifest"),
            RECOVERY_EVIDENCE,
            outcomeSig,
            resolverSig
        );

        vault.sealQualifierSetRecoveryCoSigned(
            qualifiers,
            DEFAULT_MANIFEST,
            RECOVERY_EVIDENCE,
            outcomeSig,
            resolverSig
        );
    }

    function testOrganizerWinnerRejectsWrongAmountNonQualifierAndExpiredWindow() public {
        MatrixToken token = new MatrixToken();
        ProductionCandidateChallengeVault vault = _deployAndFund(token, address(resolver), 100);
        _sealSinglePayout(vault);
        _sealSingleQualifierNormal(vault);

        ProductionCandidateChallengeVault.RecipientClaimInput memory valid =
            ProductionCandidateChallengeVault.RecipientClaimInput(ENTRY_A, 0, ALICE, 100, new bytes32[](0));

        ProductionCandidateChallengeVault.RecipientClaimInput memory wrongAmount =
            ProductionCandidateChallengeVault.RecipientClaimInput(ENTRY_A, 0, ALICE, 99, new bytes32[](0));
        vm.expectRevert(ProductionCandidateChallengeVault.InvalidSettlementAmount.selector);
        vault.authorizeOrganizerWinner(DEFAULT_MANIFEST, wrongAmount, hex"", hex"");

        ProductionCandidateChallengeVault.RecipientClaimInput memory nonQualifier =
            ProductionCandidateChallengeVault.RecipientClaimInput(ENTRY_B, 0, BOB, 100, new bytes32[](0));
        vm.expectRevert(ProductionCandidateChallengeVault.InvalidQualifierProof.selector);
        vault.authorizeOrganizerWinner(DEFAULT_MANIFEST, nonQualifier, hex"", hex"");

        vm.warp(organizerDeadline);
        vm.expectRevert(ProductionCandidateChallengeVault.OrganizerSelectionExpired.selector);
        vault.authorizeOrganizerWinner(DEFAULT_MANIFEST, valid, hex"", hex"");
    }

    function testSettlementAuthorizationAndClaimAreSingleUse() public {
        MatrixToken token = new MatrixToken();
        ProductionCandidateChallengeVault vault = _deployAndFund(token, address(resolver), 100);
        _sealSinglePayout(vault);
        _sealSingleQualifierNormal(vault);

        ProductionCandidateChallengeVault.RecipientClaimInput memory recipient =
            ProductionCandidateChallengeVault.RecipientClaimInput(ENTRY_A, 0, ALICE, 100, new bytes32[](0));

        vm.warp(organizerDeadline);
        vault.executeDefaultSingleQualifier(recipient);

        vm.expectRevert(ProductionCandidateChallengeVault.SettlementAlreadyAuthorized.selector);
        vault.executeDefaultSingleQualifier(recipient);

        vault.claimFor(ALICE);
        vm.expectRevert(ProductionCandidateChallengeVault.NothingToClaim.selector);
        vault.claimFor(ALICE);
    }

    function _assertHostileResolverRejects(address hostileResolver) internal {
        MatrixToken token = new MatrixToken();
        ProductionCandidateChallengeVault vault = _deployAndFund(token, hostileResolver, 100);
        _sealSinglePayout(vault);

        ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers = _singleQualifier();
        bytes32 root = vault.payoutLeaf(ENTRY_A, 0, ALICE);

        vm.warp(resolutionDeadline);
        vm.expectRevert(ProductionCandidateChallengeVault.WrongAuthority.selector);
        vault.sealQualifierSetRecovery(qualifiers, DEFAULT_MANIFEST, RECOVERY_EVIDENCE, hex"1234");
    }

    function _deployAndFund(MatrixToken token, address resolverAddress, uint256 prize)
        internal
        returns (ProductionCandidateChallengeVault vault)
    {
        vault = new ProductionCandidateChallengeVault(_config(token, resolverAddress, prize));
        token.mint(address(this), prize);
        token.approve(address(vault), prize);
        vault.fund();
    }

    function _config(MatrixToken token, address resolverAddress, uint256 prize)
        internal
        view
        returns (ProductionCandidateChallengeVault.VaultConfig memory)
    {
        return ProductionCandidateChallengeVault.VaultConfig({
            token: token,
            challengeDigest: CHALLENGE,
            termsDigest: TERMS,
            bindingDigest: BINDING,
            prizeAmount: prize,
            activationDeadline: activationDeadline,
            organizerSelectionDeadline: organizerDeadline,
            resolutionDeadline: resolutionDeadline,
            terminalLongStop: terminalDeadline,
            refundRecipient: REFUND,
            outcomeAuthority: outcome,
            organizerSelectionAuthority: organizer,
            resolverAuthority: resolverAddress,
            preBuildRefundManifestDigest: PREBUILD_MANIFEST,
            terminalRefundManifestDigest: TERMINAL_MANIFEST
        });
    }

    function _sealSinglePayout(ProductionCandidateChallengeVault vault) internal {
        bytes32 root = vault.payoutLeaf(ENTRY_A, 0, ALICE);
        _sealPayout(vault, root, 1);
    }

    function _sealPayout(ProductionCandidateChallengeVault vault, bytes32 root, uint16 count) internal {
        bytes32 digest = vault.payoutSetAuthorizationDigest(root, count);
        vault.sealPayoutSet(root, count, _sign(OUTCOME_PK, digest), _sign(ORGANIZER_PK, digest));
    }

    function _sealSingleQualifierNormal(ProductionCandidateChallengeVault vault) internal {
        ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers = _singleQualifier();
        bytes32 root = vault.payoutLeaf(ENTRY_A, 0, ALICE);
        _sealNormal(vault, qualifiers, root);
    }

    function _sealNormal(
        ProductionCandidateChallengeVault vault,
        ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers,
        bytes32 root
    ) internal {
        bytes32 digest = vault.qualifierSetAuthorizationDigest(
            root,
            uint16(qualifiers.length),
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
    }

    function _singleQualifier()
        internal
        pure
        returns (ProductionCandidateChallengeVault.PayoutMemberInput[] memory qualifiers)
    {
        qualifiers = new ProductionCandidateChallengeVault.PayoutMemberInput[](1);
        qualifiers[0] =
            ProductionCandidateChallengeVault.PayoutMemberInput(ENTRY_A, 0, ALICE, new bytes32[](0));
    }

    function _threeLeafTree(ProductionCandidateChallengeVault vault)
        internal
        view
        returns (bytes32 root, bytes32[] memory proofA, bytes32[] memory proofB, bytes32[] memory proofC)
    {
        bytes32 leafA = vault.payoutLeaf(ENTRY_A, 0, ALICE);
        bytes32 leafB = vault.payoutLeaf(ENTRY_B, 1, BOB);
        bytes32 leafC = vault.payoutLeaf(ENTRY_C, 2, CAROL);

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

    function _highSSignature(bytes memory signature) internal pure returns (bytes memory) {
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        uint256 highS = SECP256K1N - uint256(s);
        uint8 flippedV = v == 27 ? 28 : 27;
        return abi.encodePacked(r, bytes32(highS), flippedV);
    }

    function _copy(bytes memory source) internal pure returns (bytes memory out) {
        out = new bytes(source.length);
        for (uint256 i = 0; i < source.length; ++i) out[i] = source[i];
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
}
