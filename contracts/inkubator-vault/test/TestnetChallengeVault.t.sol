// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IERC20Minimal, TestnetChallengeVault} from "../src/TestnetChallengeVault.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
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

    function testConstructorRejectsSingleActorWinnerAuthority() public {
        vm.expectRevert(TestnetChallengeVault.AuthoritiesMustBeIndependent.selector);
        new TestnetChallengeVault(
            token,
            CHALLENGE,
            TERMS,
            BINDING,
            PRIZE,
            organizer,
            outcome,
            outcome,
            resolver
        );
    }

    function testPayoutSetRequiresBothIndependentAuthoritiesAndCannotReseal() public {
        (bytes32 root,,,) = _threeLeafTree();
        bytes32 digest = vault.payoutSetAuthorizationDigest(root, 3);

        vm.expectRevert(TestnetChallengeVault.WrongAuthority.selector);
        vault.sealPayoutSet(root, 3, _sign(OUTCOME_PK, digest), _sign(OUTCOME_PK, digest));

        vault.sealPayoutSet(root, 3, _sign(OUTCOME_PK, digest), _sign(ORGANIZER_PK, digest));
        _assert(vault.payoutSetSealed(), "payout set should be sealed");
        _assertEq(vault.payoutSetRoot(), root, "payout root");

        vm.expectRevert(TestnetChallengeVault.PayoutSetAlreadySealed.selector);
        vault.sealPayoutSet(root, 3, _sign(OUTCOME_PK, digest), _sign(ORGANIZER_PK, digest));
    }

    function testWinnerRequiresFrozenRecipientProofAndDualAuthorization() public {
        (bytes32 root, bytes32[] memory proofA,,) = _threeLeafTree();
        _seal(root, 3);

        TestnetChallengeVault.RecipientClaimInput memory winner =
            TestnetChallengeVault.RecipientClaimInput(entryA, alice, PRIZE, proofA);

        bytes32 manifest = keccak256("manifest:winner");
        bytes32 recipientsDigest = vault.singleRecipientDigest(entryA, alice, PRIZE);
        bytes32 digest = vault.settlementAuthorizationDigest(
            manifest,
            root,
            TestnetChallengeVault.SettlementKind.WINNER_PAYOUT,
            recipientsDigest
        );

        vm.expectRevert(TestnetChallengeVault.WrongAuthority.selector);
        vault.authorizeWinner(
            manifest,
            winner,
            _sign(OUTCOME_PK, digest),
            _sign(OUTCOME_PK, digest)
        );

        vault.authorizeWinner(
            manifest,
            winner,
            _sign(OUTCOME_PK, digest),
            _sign(ORGANIZER_PK, digest)
        );

        _assertEq(vault.claimable(alice), PRIZE, "winner claimable");
        _assert(!vault.isFinalized(), "not finalized before claim");

        vm.prank(address(0xD00D));
        vault.claimFor(alice);

        _assertEq(token.balanceOf(alice), PRIZE, "winner paid");
        _assert(vault.isFinalized(), "finalized after full claim");
    }

    function testWinnerCannotRedirectToUnsealedRecipient() public {
        (bytes32 root, bytes32[] memory proofA,,) = _threeLeafTree();
        _seal(root, 3);

        address attacker = address(0xBAD);
        TestnetChallengeVault.RecipientClaimInput memory redirected =
            TestnetChallengeVault.RecipientClaimInput(entryA, attacker, PRIZE, proofA);

        bytes32 manifest = keccak256("manifest:redirect");
        bytes32 recipientsDigest = vault.singleRecipientDigest(entryA, attacker, PRIZE);
        bytes32 digest = vault.settlementAuthorizationDigest(
            manifest,
            root,
            TestnetChallengeVault.SettlementKind.WINNER_PAYOUT,
            recipientsDigest
        );

        vm.expectRevert(TestnetChallengeVault.InvalidPayoutProof.selector);
        vault.authorizeWinner(
            manifest,
            redirected,
            _sign(OUTCOME_PK, digest),
            _sign(ORGANIZER_PK, digest)
        );
    }

    function testManifestSignatureCannotReplayAcrossDifferentManifest() public {
        (bytes32 root, bytes32[] memory proofA,,) = _threeLeafTree();
        _seal(root, 3);

        TestnetChallengeVault.RecipientClaimInput memory winner =
            TestnetChallengeVault.RecipientClaimInput(entryA, alice, PRIZE, proofA);

        bytes32 manifestA = keccak256("manifest:A");
        bytes32 manifestB = keccak256("manifest:B");
        bytes32 recipientsDigest = vault.singleRecipientDigest(entryA, alice, PRIZE);
        bytes32 digestA = vault.settlementAuthorizationDigest(
            manifestA,
            root,
            TestnetChallengeVault.SettlementKind.WINNER_PAYOUT,
            recipientsDigest
        );

        vm.expectRevert(TestnetChallengeVault.WrongAuthority.selector);
        vault.authorizeWinner(
            manifestB,
            winner,
            _sign(OUTCOME_PK, digestA),
            _sign(ORGANIZER_PK, digestA)
        );
    }

    function testSecondSettlementManifestIsRejected() public {
        (bytes32 root, bytes32[] memory proofA,,) = _threeLeafTree();
        _seal(root, 3);

        TestnetChallengeVault.RecipientClaimInput memory winner =
            TestnetChallengeVault.RecipientClaimInput(entryA, alice, PRIZE, proofA);

        bytes32 first = keccak256("manifest:first");
        bytes32 recipientsDigest = vault.singleRecipientDigest(entryA, alice, PRIZE);
        bytes32 firstDigest = vault.settlementAuthorizationDigest(
            first,
            root,
            TestnetChallengeVault.SettlementKind.WINNER_PAYOUT,
            recipientsDigest
        );
        vault.authorizeWinner(first, winner, _sign(OUTCOME_PK, firstDigest), _sign(ORGANIZER_PK, firstDigest));

        bytes32 second = keccak256("manifest:second");
        bytes32 secondDigest = vault.settlementAuthorizationDigest(
            second,
            root,
            TestnetChallengeVault.SettlementKind.WINNER_PAYOUT,
            recipientsDigest
        );

        vm.expectRevert(TestnetChallengeVault.SettlementAlreadyAuthorized.selector);
        vault.authorizeWinner(second, winner, _sign(OUTCOME_PK, secondDigest), _sign(ORGANIZER_PK, secondDigest));
    }

    function testDefaultSplitIsPolicyCheckedClaimableAndBlockedRecipientDoesNotFreezeOthers() public {
        (bytes32 root, bytes32[] memory proofA, bytes32[] memory proofB, bytes32[] memory proofC) = _threeLeafTree();
        _seal(root, 3);

        uint256 base = PRIZE / 3;
        uint256 remainder = PRIZE % 3;
        _assertEq(remainder, 1, "fixture remainder");

        TestnetChallengeVault.RecipientClaimInput[] memory recipients =
            new TestnetChallengeVault.RecipientClaimInput[](3);
        recipients[0] = TestnetChallengeVault.RecipientClaimInput(entryA, alice, base + 1, proofA);
        recipients[1] = TestnetChallengeVault.RecipientClaimInput(entryB, bob, base, proofB);
        recipients[2] = TestnetChallengeVault.RecipientClaimInput(entryC, carol, base, proofC);

        bytes32 manifest = keccak256("manifest:default");
        bytes32 recipientsDigest = _recipientDigest(recipients);
        bytes32 digest = vault.settlementAuthorizationDigest(
            manifest,
            root,
            TestnetChallengeVault.SettlementKind.DEFAULT_DISTRIBUTION,
            recipientsDigest
        );

        vault.authorizeDefaultDistribution(manifest, recipients, _sign(OUTCOME_PK, digest));

        token.setBlockedRecipient(alice);

        vm.prank(address(0xD00D));
        vault.claimFor(bob);
        _assertEq(token.balanceOf(bob), base, "bob claim should succeed");
        _assert(!vault.isFinalized(), "blocked recipient must leave settlement pending");

        vm.expectRevert(TestnetChallengeVault.TokenTransferFailed.selector);
        vault.claimFor(alice);
        _assertEq(vault.claimable(alice), base + 1, "failed claim must remain claimable");

        vault.claimFor(carol);
        _assertEq(token.balanceOf(carol), base, "carol claim should succeed");

        token.setBlockedRecipient(address(0));
        vault.claimFor(alice);

        _assert(vault.isFinalized(), "settlement should finalize after all claims");
        _assertEq(vault.totalClaimed(), PRIZE, "full prize claimed");
    }

    function testDefaultSplitRejectsSkewedEconomicsEvenWithValidOutcomeSignature() public {
        (bytes32 root, bytes32[] memory proofA, bytes32[] memory proofB, bytes32[] memory proofC) = _threeLeafTree();
        _seal(root, 3);

        TestnetChallengeVault.RecipientClaimInput[] memory recipients =
            new TestnetChallengeVault.RecipientClaimInput[](3);
        recipients[0] = TestnetChallengeVault.RecipientClaimInput(entryA, alice, PRIZE - 2, proofA);
        recipients[1] = TestnetChallengeVault.RecipientClaimInput(entryB, bob, 1, proofB);
        recipients[2] = TestnetChallengeVault.RecipientClaimInput(entryC, carol, 1, proofC);

        bytes32 manifest = keccak256("manifest:skew");
        bytes32 digest = vault.settlementAuthorizationDigest(
            manifest,
            root,
            TestnetChallengeVault.SettlementKind.DEFAULT_DISTRIBUTION,
            _recipientDigest(recipients)
        );

        vm.expectRevert(TestnetChallengeVault.InvalidSettlementAmount.selector);
        vault.authorizeDefaultDistribution(manifest, recipients, _sign(OUTCOME_PK, digest));
    }

    function testNoQualifierRefundRequiresOutcomeAuthorityAndPaysFrozenRefundRecipient() public {
        (bytes32 root,,,) = _threeLeafTree();
        _seal(root, 3);

        bytes32 manifest = keccak256("manifest:no-qualifier");
        bytes32 recipientsDigest = vault.singleRecipientDigest(bytes32(0), organizer, PRIZE);
        bytes32 digest = vault.settlementAuthorizationDigest(
            manifest,
            root,
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

    function testResolutionCancellationUsesSeparateResolverAndNeedsNoPayoutSet() public {
        bytes32 manifest = keccak256("manifest:resolution-cancel");
        bytes32 recipientsDigest = vault.singleRecipientDigest(bytes32(0), organizer, PRIZE);
        bytes32 digest = vault.settlementAuthorizationDigest(
            manifest,
            bytes32(0),
            TestnetChallengeVault.SettlementKind.CANCELLED_BY_RESOLUTION,
            recipientsDigest
        );

        vm.expectRevert(TestnetChallengeVault.WrongAuthority.selector);
        vault.authorizeResolutionCancellation(manifest, _sign(OUTCOME_PK, digest));

        vault.authorizeResolutionCancellation(manifest, _sign(RESOLVER_PK, digest));
        vault.claimFor(organizer);

        _assert(vault.isFinalized(), "resolver refund finalized");
    }

    function testCannotAuthorizeSettlementBeforeFunding() public {
        MockERC20 freshToken = new MockERC20();
        TestnetChallengeVault freshVault = _deploy(freshToken, PRIZE);

        bytes32 manifest = keccak256("manifest:premature");
        bytes32 recipientsDigest = freshVault.singleRecipientDigest(bytes32(0), organizer, PRIZE);
        bytes32 digest = freshVault.settlementAuthorizationDigest(
            manifest,
            bytes32(0),
            TestnetChallengeVault.SettlementKind.CANCELLED_BY_RESOLUTION,
            recipientsDigest
        );

        vm.expectRevert(TestnetChallengeVault.NotFunded.selector);
        freshVault.authorizeResolutionCancellation(manifest, _sign(RESOLVER_PK, digest));
    }

    function _deploy(MockERC20 token_, uint256 amount) internal returns (TestnetChallengeVault) {
        return new TestnetChallengeVault(
            token_,
            CHALLENGE,
            TERMS,
            BINDING,
            amount,
            organizer,
            outcome,
            organizer,
            resolver
        );
    }

    function _seal(bytes32 root, uint16 count) internal {
        bytes32 digest = vault.payoutSetAuthorizationDigest(root, count);
        vault.sealPayoutSet(root, count, _sign(OUTCOME_PK, digest), _sign(ORGANIZER_PK, digest));
    }

    function _threeLeafTree()
        internal
        view
        returns (bytes32 root, bytes32[] memory proofA, bytes32[] memory proofB, bytes32[] memory proofC)
    {
        bytes32 leafA = vault.payoutLeaf(entryA, alice);
        bytes32 leafB = vault.payoutLeaf(entryB, bob);
        bytes32 leafC = vault.payoutLeaf(entryC, carol);

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
