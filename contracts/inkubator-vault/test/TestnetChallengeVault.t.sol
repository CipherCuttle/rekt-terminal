// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IERC20Minimal, TestnetChallengeVault} from "../src/TestnetChallengeVault.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
    function warp(uint256 timestamp) external;
}

contract MockERC20 is IERC20Minimal {
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
        _move(msg.sender, to, amount);
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

    function _move(address from, address to, uint256 amount) internal {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

contract TestnetChallengeVaultTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant OUTCOME_PK = 0xA11CE;
    uint256 private constant ORGANIZER_PK = 0xB0B;
    uint256 private constant RESOLVER_PK = 0xCAFE;

    uint256 private constant PRIZE = 250_000_000;
    uint256 private selectionDeadline;

    bytes32 private constant CHALLENGE = keccak256("challenge:stage-j1");
    bytes32 private constant TERMS = keccak256("terms:stage-j1");
    bytes32 private constant BINDING = keccak256("binding:stage-j1");

    MockERC20 private token;
    TestnetChallengeVault private vault;

    address private outcome;
    address private organizer;
    address private resolver;

    bytes32 private entryA;
    bytes32 private entryB;
    bytes32 private entryC;
    address private alice;
    address private bob;
    address private carol;

    function setUp() public {
        outcome = vm.addr(OUTCOME_PK);
        organizer = vm.addr(ORGANIZER_PK);
        resolver = vm.addr(RESOLVER_PK);

        entryA = bytes32(uint256(1));
        entryB = bytes32(uint256(2));
        entryC = bytes32(uint256(3));

        alice = address(0xA11C);
        bob = address(0xB0B0);
        carol = address(0xCA20);

        selectionDeadline = block.timestamp + 7 days;
        token = new MockERC20();
        vault = _deploy(token, PRIZE);

        token.mint(address(this), PRIZE);
        token.approve(address(vault), PRIZE);
        vault.fund();
    }

    function testFundingIsExactAndSingleShot() public {
        _assert(vault.funded(), "vault should be funded");
        _assertEq(token.balanceOf(address(vault)), PRIZE, "vault balance");

        vm.expectRevert(TestnetChallengeVault.AlreadyFunded.selector);
        vault.fund();
    }

    function testFundingRejectsFeeOnTransferTokens() public {
        MockERC20 feeToken = new MockERC20();
        TestnetChallengeVault feeVault = _deploy(feeToken, PRIZE);

        feeToken.mint(address(this), PRIZE);
        feeToken.approve(address(feeVault), PRIZE);
        feeToken.setTransferFromFeeBps(100);

        vm.expectRevert(TestnetChallengeVault.FundingAmountMismatch.selector);
        feeVault.fund();
    }


    function testUnsolicitedPrefundingDustDoesNotBrickExactFunding() public {
        MockERC20 dustToken = new MockERC20();
        TestnetChallengeVault dustVault = _deploy(dustToken, PRIZE);

        dustToken.mint(address(dustVault), 1);
        dustToken.mint(address(this), PRIZE);
        dustToken.approve(address(dustVault), PRIZE);

        dustVault.fund();

        _assert(dustVault.funded(), "dust must not block funding");
        _assertEq(dustToken.balanceOf(address(dustVault)), PRIZE + 1, "surplus remains outside prize accounting");
        _assertEq(dustVault.remainingLiability(), PRIZE, "liability stays exact prize");
    }

    function testConstructorRequiresPairwiseIndependentAuthorities() public {
        vm.expectRevert(TestnetChallengeVault.AuthoritiesMustBeIndependent.selector);
        new TestnetChallengeVault(token, CHALLENGE, TERMS, BINDING, PRIZE, selectionDeadline, organizer, outcome, outcome, resolver);

        vm.expectRevert(TestnetChallengeVault.AuthoritiesMustBeIndependent.selector);
        new TestnetChallengeVault(token, CHALLENGE, TERMS, BINDING, PRIZE, selectionDeadline, organizer, outcome, organizer, outcome);
    }

    function testPayoutSetRequiresOutcomeAndOrganizerAndCannotReseal() public {
        (bytes32 root,,,) = _payoutTree();
        bytes32 digest = vault.payoutSetAuthorizationDigest(root, 3);

        vm.expectRevert(TestnetChallengeVault.WrongAuthority.selector);
        vault.sealPayoutSet(root, 3, _sign(OUTCOME_PK, digest), _sign(OUTCOME_PK, digest));

        vault.sealPayoutSet(root, 3, _sign(OUTCOME_PK, digest), _sign(ORGANIZER_PK, digest));
        _assert(vault.payoutSetSealed(), "payout set should be sealed");

        vm.expectRevert(TestnetChallengeVault.PayoutSetAlreadySealed.selector);
        vault.sealPayoutSet(root, 3, _sign(OUTCOME_PK, digest), _sign(ORGANIZER_PK, digest));
    }

    function testQualifierSetMustBeSubsetOfPayoutSetAndNeedsIndependentCoAuthority() public {
        (bytes32 payoutRoot, bytes32[] memory payoutProofA, bytes32[] memory payoutProofB,) = _payoutTree();
        _sealPayoutSet(payoutRoot, 3);

        TestnetChallengeVault.PayoutMemberInput[] memory qualifiers =
            new TestnetChallengeVault.PayoutMemberInput[](2);
        qualifiers[0] = TestnetChallengeVault.PayoutMemberInput(entryA, 0, alice, payoutProofA);
        qualifiers[1] = TestnetChallengeVault.PayoutMemberInput(entryB, 1, bob, payoutProofB);

        bytes32 qualifierRoot = _twoLeafRoot(entryA, alice, entryB, bob);
        bytes32 digest = vault.qualifierSetAuthorizationDigest(
            qualifierRoot,
            2,
            TestnetChallengeVault.QualifierSetCoAuthority.ORGANIZER
        );

        vm.expectRevert(TestnetChallengeVault.WrongAuthority.selector);
        vault.sealQualifierSet(
            qualifiers,
            TestnetChallengeVault.QualifierSetCoAuthority.ORGANIZER,
            _sign(OUTCOME_PK, digest),
            _sign(OUTCOME_PK, digest)
        );

        vault.sealQualifierSet(
            qualifiers,
            TestnetChallengeVault.QualifierSetCoAuthority.ORGANIZER,
            _sign(OUTCOME_PK, digest),
            _sign(ORGANIZER_PK, digest)
        );

        _assert(vault.qualificationResolved(), "qualification should resolve");
        _assertEq(vault.qualifierSetRoot(), qualifierRoot, "qualifier root");
        _assertEq(uint256(vault.qualifierCount()), 2, "qualifier count");
    }

    function testQualifierSetCanUseResolverFallbackWhenOrganizerUnavailable() public {
        (bytes32 payoutRoot, bytes32[] memory payoutProofA, bytes32[] memory payoutProofB,) = _payoutTree();
        _sealPayoutSet(payoutRoot, 3);

        TestnetChallengeVault.PayoutMemberInput[] memory qualifiers =
            new TestnetChallengeVault.PayoutMemberInput[](2);
        qualifiers[0] = TestnetChallengeVault.PayoutMemberInput(entryA, 0, alice, payoutProofA);
        qualifiers[1] = TestnetChallengeVault.PayoutMemberInput(entryB, 1, bob, payoutProofB);

        bytes32 qualifierRoot = _twoLeafRoot(entryA, alice, entryB, bob);
        bytes32 digest = vault.qualifierSetAuthorizationDigest(
            qualifierRoot,
            2,
            TestnetChallengeVault.QualifierSetCoAuthority.RESOLVER
        );

        vault.sealQualifierSet(
            qualifiers,
            TestnetChallengeVault.QualifierSetCoAuthority.RESOLVER,
            _sign(OUTCOME_PK, digest),
            _sign(RESOLVER_PK, digest)
        );

        _assertEq(uint256(vault.qualifierSetCoAuthority()), 1, "resolver co-authority");
    }

    function testOrganizerWinnerMustBeFrozenFinalQualifierAndDualAuthorized() public {
        (bytes32 qualifierRoot, bytes32[] memory qualifierProofA,) = _sealQualifiersAB();

        TestnetChallengeVault.RecipientClaimInput memory winner =
            TestnetChallengeVault.RecipientClaimInput(entryA, 0, alice, PRIZE, qualifierProofA);

        bytes32 manifest = keccak256("manifest:organizer-winner");
        bytes32 recipientsDigest = vault.singleRecipientDigest(entryA, 0, alice, PRIZE);
        bytes32 digest = vault.settlementAuthorizationDigest(
            manifest,
            qualifierRoot,
            TestnetChallengeVault.SettlementKind.ORGANIZER_WINNER,
            recipientsDigest
        );

        vm.expectRevert(TestnetChallengeVault.WrongAuthority.selector);
        vault.authorizeOrganizerWinner(
            manifest,
            winner,
            _sign(OUTCOME_PK, digest),
            _sign(OUTCOME_PK, digest)
        );

        vault.authorizeOrganizerWinner(
            manifest,
            winner,
            _sign(OUTCOME_PK, digest),
            _sign(ORGANIZER_PK, digest)
        );

        vm.prank(address(0xD00D));
        vault.claimFor(alice);

        _assertEq(token.balanceOf(alice), PRIZE, "winner paid");
        _assert(vault.isFinalized(), "winner settlement finalized");
    }

    function testOrganizerCannotSelectEntrantWhoDidNotQualify() public {
        (bytes32 payoutRoot,,, bytes32[] memory payoutProofC) = _payoutTree();
        _sealPayoutSet(payoutRoot, 3);

        TestnetChallengeVault.PayoutMemberInput[] memory qualifiers =
            new TestnetChallengeVault.PayoutMemberInput[](1);
        bytes32[] memory payoutProofA = _proofA();
        qualifiers[0] = TestnetChallengeVault.PayoutMemberInput(entryA, 0, alice, payoutProofA);
        _sealQualifierSet(qualifiers, TestnetChallengeVault.QualifierSetCoAuthority.ORGANIZER);

        TestnetChallengeVault.RecipientClaimInput memory nonQualifier =
            TestnetChallengeVault.RecipientClaimInput(entryC, 2, carol, PRIZE, payoutProofC);

        bytes32 manifest = keccak256("manifest:nonqualifier");
        bytes32 recipientsDigest = vault.singleRecipientDigest(entryC, 2, carol, PRIZE);
        bytes32 digest = vault.settlementAuthorizationDigest(
            manifest,
            vault.qualifierSetRoot(),
            TestnetChallengeVault.SettlementKind.ORGANIZER_WINNER,
            recipientsDigest
        );

        vm.expectRevert(TestnetChallengeVault.InvalidQualifierProof.selector);
        vault.authorizeOrganizerWinner(
            manifest,
            nonQualifier,
            _sign(OUTCOME_PK, digest),
            _sign(ORGANIZER_PK, digest)
        );
    }

    function testSingleQualifierDefaultPaysWithoutOrganizerSelectionSignature() public {
        (bytes32 payoutRoot, bytes32[] memory payoutProofA,,) = _payoutTree();
        _sealPayoutSet(payoutRoot, 3);

        TestnetChallengeVault.PayoutMemberInput[] memory qualifiers =
            new TestnetChallengeVault.PayoutMemberInput[](1);
        qualifiers[0] = TestnetChallengeVault.PayoutMemberInput(entryA, 0, alice, payoutProofA);
        _sealQualifierSet(qualifiers, TestnetChallengeVault.QualifierSetCoAuthority.ORGANIZER);

        TestnetChallengeVault.RecipientClaimInput memory soleQualifier =
            TestnetChallengeVault.RecipientClaimInput(entryA, 0, alice, PRIZE, new bytes32[](0));

        bytes32 manifest = keccak256("manifest:single-default");
        bytes32 recipientsDigest = vault.singleRecipientDigest(entryA, 0, alice, PRIZE);
        bytes32 digest = vault.settlementAuthorizationDigest(
            manifest,
            vault.qualifierSetRoot(),
            TestnetChallengeVault.SettlementKind.DEFAULT_SINGLE_QUALIFIER_WINNER,
            recipientsDigest
        );

        vm.expectRevert(TestnetChallengeVault.DefaultNotEligible.selector);
        vault.authorizeSingleQualifierDefault(manifest, soleQualifier, _sign(OUTCOME_PK, digest));

        vm.warp(selectionDeadline);
        vault.authorizeSingleQualifierDefault(manifest, soleQualifier, _sign(OUTCOME_PK, digest));
        vault.claimFor(alice);

        _assertEq(token.balanceOf(alice), PRIZE, "sole qualifier paid");
        _assert(vault.isFinalized(), "single qualifier default finalized");
    }

    function testManifestSignatureCannotReplayAcrossDifferentManifest() public {
        (bytes32 qualifierRoot, bytes32[] memory qualifierProofA,) = _sealQualifiersAB();

        TestnetChallengeVault.RecipientClaimInput memory winner =
            TestnetChallengeVault.RecipientClaimInput(entryA, 0, alice, PRIZE, qualifierProofA);

        bytes32 manifestA = keccak256("manifest:A");
        bytes32 manifestB = keccak256("manifest:B");
        bytes32 recipientsDigest = vault.singleRecipientDigest(entryA, 0, alice, PRIZE);
        bytes32 digestA = vault.settlementAuthorizationDigest(
            manifestA,
            qualifierRoot,
            TestnetChallengeVault.SettlementKind.ORGANIZER_WINNER,
            recipientsDigest
        );

        vm.expectRevert(TestnetChallengeVault.WrongAuthority.selector);
        vault.authorizeOrganizerWinner(
            manifestB,
            winner,
            _sign(OUTCOME_PK, digestA),
            _sign(ORGANIZER_PK, digestA)
        );
    }

    function testSecondSettlementManifestIsRejected() public {
        (bytes32 qualifierRoot, bytes32[] memory qualifierProofA,) = _sealQualifiersAB();

        TestnetChallengeVault.RecipientClaimInput memory winner =
            TestnetChallengeVault.RecipientClaimInput(entryA, 0, alice, PRIZE, qualifierProofA);

        bytes32 first = keccak256("manifest:first");
        bytes32 recipientsDigest = vault.singleRecipientDigest(entryA, 0, alice, PRIZE);
        bytes32 firstDigest = vault.settlementAuthorizationDigest(
            first,
            qualifierRoot,
            TestnetChallengeVault.SettlementKind.ORGANIZER_WINNER,
            recipientsDigest
        );
        vault.authorizeOrganizerWinner(
            first,
            winner,
            _sign(OUTCOME_PK, firstDigest),
            _sign(ORGANIZER_PK, firstDigest)
        );

        bytes32 second = keccak256("manifest:second");
        bytes32 secondDigest = vault.settlementAuthorizationDigest(
            second,
            qualifierRoot,
            TestnetChallengeVault.SettlementKind.ORGANIZER_WINNER,
            recipientsDigest
        );

        vm.expectRevert(TestnetChallengeVault.SettlementAlreadyAuthorized.selector);
        vault.authorizeOrganizerWinner(
            second,
            winner,
            _sign(OUTCOME_PK, secondDigest),
            _sign(ORGANIZER_PK, secondDigest)
        );
    }

    function testDefaultSplitUsesEntireFrozenQualifierSetAndBlockedRecipientDoesNotFreezeOthers() public {
        (bytes32 qualifierRoot, bytes32[] memory proofA, bytes32[] memory proofB, bytes32[] memory proofC) =
            _sealQualifiersABC();

        uint256 base = PRIZE / 3;
        uint256 remainder = PRIZE % 3;
        _assertEq(remainder, 1, "fixture remainder");

        TestnetChallengeVault.RecipientClaimInput[] memory recipients =
            new TestnetChallengeVault.RecipientClaimInput[](3);
        recipients[0] = TestnetChallengeVault.RecipientClaimInput(entryA, 0, alice, base + 1, proofA);
        recipients[1] = TestnetChallengeVault.RecipientClaimInput(entryB, 1, bob, base, proofB);
        recipients[2] = TestnetChallengeVault.RecipientClaimInput(entryC, 2, carol, base, proofC);

        bytes32 manifest = keccak256("manifest:default");
        bytes32 recipientsDigest = _recipientDigest(recipients);
        bytes32 digest = vault.settlementAuthorizationDigest(
            manifest,
            qualifierRoot,
            TestnetChallengeVault.SettlementKind.DEFAULT_DISTRIBUTION,
            recipientsDigest
        );

        vm.expectRevert(TestnetChallengeVault.DefaultNotEligible.selector);
        vault.authorizeDefaultDistribution(manifest, recipients, _sign(OUTCOME_PK, digest));

        vm.warp(selectionDeadline);
        vault.authorizeDefaultDistribution(manifest, recipients, _sign(OUTCOME_PK, digest));

        token.setBlockedRecipient(alice);

        vm.prank(address(0xD00D));
        vault.claimFor(bob);
        _assertEq(token.balanceOf(bob), base, "bob claim succeeds");
        _assert(!vault.isFinalized(), "blocked recipient leaves settlement pending");

        vm.expectRevert(TestnetChallengeVault.TokenTransferFailed.selector);
        vault.claimFor(alice);
        _assertEq(vault.claimable(alice), base + 1, "failed claim remains claimable");

        vault.claimFor(carol);
        token.setBlockedRecipient(address(0));
        vault.claimFor(alice);

        _assert(vault.isFinalized(), "settlement finalizes after all claims");
        _assertEq(vault.totalClaimed(), PRIZE, "full prize claimed");
    }

    function testDefaultSplitCannotExcludeFrozenQualifier() public {
        (bytes32 qualifierRoot, bytes32[] memory proofA, bytes32[] memory proofB,) = _sealQualifiersABC();

        TestnetChallengeVault.RecipientClaimInput[] memory recipients =
            new TestnetChallengeVault.RecipientClaimInput[](2);
        recipients[0] = TestnetChallengeVault.RecipientClaimInput(entryA, 0, alice, PRIZE / 2, proofA);
        recipients[1] = TestnetChallengeVault.RecipientClaimInput(entryB, 1, bob, PRIZE / 2, proofB);

        bytes32 manifest = keccak256("manifest:subset");
        bytes32 digest = vault.settlementAuthorizationDigest(
            manifest,
            qualifierRoot,
            TestnetChallengeVault.SettlementKind.DEFAULT_DISTRIBUTION,
            _recipientDigest(recipients)
        );

        vm.warp(selectionDeadline);
        vm.expectRevert(TestnetChallengeVault.InvalidRecipientSet.selector);
        vault.authorizeDefaultDistribution(manifest, recipients, _sign(OUTCOME_PK, digest));
    }

    function testDefaultSplitRejectsSkewedEconomicsEvenWithValidOutcomeSignature() public {
        (bytes32 qualifierRoot, bytes32[] memory proofA, bytes32[] memory proofB, bytes32[] memory proofC) =
            _sealQualifiersABC();

        TestnetChallengeVault.RecipientClaimInput[] memory recipients =
            new TestnetChallengeVault.RecipientClaimInput[](3);
        recipients[0] = TestnetChallengeVault.RecipientClaimInput(entryA, 0, alice, PRIZE - 2, proofA);
        recipients[1] = TestnetChallengeVault.RecipientClaimInput(entryB, 1, bob, 1, proofB);
        recipients[2] = TestnetChallengeVault.RecipientClaimInput(entryC, 2, carol, 1, proofC);

        bytes32 manifest = keccak256("manifest:skew");
        bytes32 digest = vault.settlementAuthorizationDigest(
            manifest,
            qualifierRoot,
            TestnetChallengeVault.SettlementKind.DEFAULT_DISTRIBUTION,
            _recipientDigest(recipients)
        );

        vm.warp(selectionDeadline);
        vm.expectRevert(TestnetChallengeVault.InvalidSettlementAmount.selector);
        vault.authorizeDefaultDistribution(manifest, recipients, _sign(OUTCOME_PK, digest));
    }


    function testDefaultRemainderGoesToFirstSortedQualifierOnly() public {
        (bytes32 qualifierRoot, bytes32[] memory proofA, bytes32[] memory proofB, bytes32[] memory proofC) =
            _sealQualifiersABC();

        uint256 base = PRIZE / 3;

        TestnetChallengeVault.RecipientClaimInput[] memory recipients =
            new TestnetChallengeVault.RecipientClaimInput[](3);
        recipients[0] = TestnetChallengeVault.RecipientClaimInput(entryA, 0, alice, base, proofA);
        recipients[1] = TestnetChallengeVault.RecipientClaimInput(entryB, 1, bob, base + 1, proofB);
        recipients[2] = TestnetChallengeVault.RecipientClaimInput(entryC, 2, carol, base, proofC);

        bytes32 manifest = keccak256("manifest:wrong-remainder-recipient");
        bytes32 digest = vault.settlementAuthorizationDigest(
            manifest,
            qualifierRoot,
            TestnetChallengeVault.SettlementKind.DEFAULT_DISTRIBUTION,
            _recipientDigest(recipients)
        );

        vm.warp(selectionDeadline);
        vm.expectRevert(TestnetChallengeVault.InvalidSettlementAmount.selector);
        vault.authorizeDefaultDistribution(manifest, recipients, _sign(OUTCOME_PK, digest));
    }

    function testOrganizerWinnerExpiresAtFrozenSelectionDeadline() public {
        (bytes32 qualifierRoot, bytes32[] memory qualifierProofA,) = _sealQualifiersAB();
        TestnetChallengeVault.RecipientClaimInput memory winner =
            TestnetChallengeVault.RecipientClaimInput(entryA, 0, alice, PRIZE, qualifierProofA);

        bytes32 manifest = keccak256("manifest:late-organizer-winner");
        bytes32 recipientsDigest = vault.singleRecipientDigest(entryA, 0, alice, PRIZE);
        bytes32 digest = vault.settlementAuthorizationDigest(
            manifest,
            qualifierRoot,
            TestnetChallengeVault.SettlementKind.ORGANIZER_WINNER,
            recipientsDigest
        );

        vm.warp(selectionDeadline);
        vm.expectRevert(TestnetChallengeVault.OrganizerSelectionExpired.selector);
        vault.authorizeOrganizerWinner(
            manifest,
            winner,
            _sign(OUTCOME_PK, digest),
            _sign(ORGANIZER_PK, digest)
        );
    }

    function testNoQualifierRefundNeedsFrozenZeroQualifierOutcome() public {
        (bytes32 payoutRoot,,,) = _payoutTree();
        _sealPayoutSet(payoutRoot, 3);

        TestnetChallengeVault.PayoutMemberInput[] memory none =
            new TestnetChallengeVault.PayoutMemberInput[](0);
        _sealQualifierSet(none, TestnetChallengeVault.QualifierSetCoAuthority.RESOLVER);

        bytes32 manifest = keccak256("manifest:no-qualifier");
        bytes32 recipientsDigest = vault.singleRecipientDigest(bytes32(0), 0, organizer, PRIZE);
        bytes32 digest = vault.settlementAuthorizationDigest(
            manifest,
            bytes32(0),
            TestnetChallengeVault.SettlementKind.REFUND_NO_QUALIFIER,
            recipientsDigest
        );

        vm.expectRevert(TestnetChallengeVault.WrongAuthority.selector);
        vault.authorizeNoQualifierRefund(manifest, _sign(ORGANIZER_PK, digest));

        vault.authorizeNoQualifierRefund(manifest, _sign(OUTCOME_PK, digest));
        vault.claimFor(organizer);

        _assertEq(token.balanceOf(organizer), PRIZE, "refund recipient paid");
        _assert(vault.isFinalized(), "refund finalized");
    }

    function testResolutionCancellationRequiresOutcomeAndSeparateResolver() public {
        bytes32 manifest = keccak256("manifest:resolution-cancel");
        bytes32 recipientsDigest = vault.singleRecipientDigest(bytes32(0), 0, organizer, PRIZE);
        bytes32 digest = vault.settlementAuthorizationDigest(
            manifest,
            bytes32(0),
            TestnetChallengeVault.SettlementKind.CANCELLED_BY_RESOLUTION,
            recipientsDigest
        );

        vm.expectRevert(TestnetChallengeVault.WrongAuthority.selector);
        vault.authorizeResolutionCancellation(
            manifest,
            _sign(OUTCOME_PK, digest),
            _sign(OUTCOME_PK, digest)
        );

        vault.authorizeResolutionCancellation(
            manifest,
            _sign(OUTCOME_PK, digest),
            _sign(RESOLVER_PK, digest)
        );
        vault.claimFor(organizer);

        _assert(vault.isFinalized(), "resolver cancellation finalized");
    }

    function testCannotAuthorizeSettlementBeforeFunding() public {
        MockERC20 freshToken = new MockERC20();
        TestnetChallengeVault freshVault = _deploy(freshToken, PRIZE);

        bytes32 manifest = keccak256("manifest:premature");
        bytes32 recipientsDigest = freshVault.singleRecipientDigest(bytes32(0), 0, organizer, PRIZE);
        bytes32 digest = freshVault.settlementAuthorizationDigest(
            manifest,
            bytes32(0),
            TestnetChallengeVault.SettlementKind.CANCELLED_BY_RESOLUTION,
            recipientsDigest
        );

        vm.expectRevert(TestnetChallengeVault.NotFunded.selector);
        freshVault.authorizeResolutionCancellation(
            manifest,
            _sign(OUTCOME_PK, digest),
            _sign(RESOLVER_PK, digest)
        );
    }

    function _deploy(MockERC20 token_, uint256 amount) internal returns (TestnetChallengeVault) {
        return new TestnetChallengeVault(
            token_,
            CHALLENGE,
            TERMS,
            BINDING,
            amount,
            selectionDeadline,
            organizer,
            outcome,
            organizer,
            resolver
        );
    }

    function _sealPayoutSet(bytes32 root, uint16 count) internal {
        bytes32 digest = vault.payoutSetAuthorizationDigest(root, count);
        vault.sealPayoutSet(root, count, _sign(OUTCOME_PK, digest), _sign(ORGANIZER_PK, digest));
    }

    function _sealQualifierSet(
        TestnetChallengeVault.PayoutMemberInput[] memory qualifiers,
        TestnetChallengeVault.QualifierSetCoAuthority coAuthority
    ) internal {
        bytes32 root = _qualifierRoot(qualifiers);
        bytes32 digest = vault.qualifierSetAuthorizationDigest(root, uint16(qualifiers.length), coAuthority);
        uint256 counterpartyPk =
            coAuthority == TestnetChallengeVault.QualifierSetCoAuthority.ORGANIZER ? ORGANIZER_PK : RESOLVER_PK;

        vault.sealQualifierSet(
            qualifiers,
            coAuthority,
            _sign(OUTCOME_PK, digest),
            _sign(counterpartyPk, digest)
        );
    }

    function _sealQualifiersAB()
        internal
        returns (bytes32 qualifierRoot, bytes32[] memory proofA, bytes32[] memory proofB)
    {
        (bytes32 payoutRoot, bytes32[] memory payoutProofA, bytes32[] memory payoutProofB,) = _payoutTree();
        _sealPayoutSet(payoutRoot, 3);

        TestnetChallengeVault.PayoutMemberInput[] memory qualifiers =
            new TestnetChallengeVault.PayoutMemberInput[](2);
        qualifiers[0] = TestnetChallengeVault.PayoutMemberInput(entryA, 0, alice, payoutProofA);
        qualifiers[1] = TestnetChallengeVault.PayoutMemberInput(entryB, 1, bob, payoutProofB);
        _sealQualifierSet(qualifiers, TestnetChallengeVault.QualifierSetCoAuthority.ORGANIZER);

        bytes32 leafA = vault.payoutLeaf(entryA, 0, alice);
        bytes32 leafB = vault.payoutLeaf(entryB, 1, bob);
        qualifierRoot = vault.merklePair(leafA, leafB);

        proofA = new bytes32[](1);
        proofA[0] = leafB;
        proofB = new bytes32[](1);
        proofB[0] = leafA;
    }

    function _sealQualifiersABC()
        internal
        returns (
            bytes32 qualifierRoot,
            bytes32[] memory proofA,
            bytes32[] memory proofB,
            bytes32[] memory proofC
        )
    {
        (bytes32 payoutRoot, bytes32[] memory payoutProofA, bytes32[] memory payoutProofB, bytes32[] memory payoutProofC) =
            _payoutTree();
        _sealPayoutSet(payoutRoot, 3);

        TestnetChallengeVault.PayoutMemberInput[] memory qualifiers =
            new TestnetChallengeVault.PayoutMemberInput[](3);
        qualifiers[0] = TestnetChallengeVault.PayoutMemberInput(entryA, 0, alice, payoutProofA);
        qualifiers[1] = TestnetChallengeVault.PayoutMemberInput(entryB, 1, bob, payoutProofB);
        qualifiers[2] = TestnetChallengeVault.PayoutMemberInput(entryC, 2, carol, payoutProofC);
        _sealQualifierSet(qualifiers, TestnetChallengeVault.QualifierSetCoAuthority.ORGANIZER);

        (qualifierRoot, proofA, proofB, proofC) = _payoutTree();
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

    function _proofA() internal view returns (bytes32[] memory proofA) {
        (, proofA,,) = _payoutTree();
    }

    function _twoLeafRoot(bytes32 firstEntry, address firstPayout, bytes32 secondEntry, address secondPayout)
        internal
        view
        returns (bytes32)
    {
        return vault.merklePair(
            vault.payoutLeaf(firstEntry, 0, firstPayout),
            vault.payoutLeaf(secondEntry, 1, secondPayout)
        );
    }

    function _qualifierRoot(TestnetChallengeVault.PayoutMemberInput[] memory qualifiers)
        internal
        view
        returns (bytes32)
    {
        if (qualifiers.length == 0) return bytes32(0);
        bytes32 first =
            vault.payoutLeaf(qualifiers[0].entryDigest, qualifiers[0].payoutOrder, qualifiers[0].payout);
        if (qualifiers.length == 1) return first;

        bytes32 second =
            vault.payoutLeaf(qualifiers[1].entryDigest, qualifiers[1].payoutOrder, qualifiers[1].payout);
        if (qualifiers.length == 2) return vault.merklePair(first, second);

        bytes32 third =
            vault.payoutLeaf(qualifiers[2].entryDigest, qualifiers[2].payoutOrder, qualifiers[2].payout);
        return vault.merklePair(vault.merklePair(first, second), vault.merklePair(third, third));
    }

    function _recipientDigest(TestnetChallengeVault.RecipientClaimInput[] memory recipients)
        internal
        view
        returns (bytes32 digest)
    {
        digest = keccak256("");
        for (uint256 index = 0; index < recipients.length; ++index) {
            digest = keccak256(
                abi.encode(
                    digest,
                    vault.recipientItemHash(
                        recipients[index].entryDigest,
                        recipients[index].payoutOrder,
                        recipients[index].payout,
                        recipients[index].amount
                    )
                )
            );
        }
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

    function _assertEq(bytes32 left, bytes32 right, string memory message) internal pure {
        require(left == right, message);
    }
}
