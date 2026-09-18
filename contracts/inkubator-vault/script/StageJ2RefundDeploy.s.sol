// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {TestnetChallengeVault, IERC20Minimal} from "../src/TestnetChallengeVault.sol";
import {StageJ2RehearsalToken} from "../src/StageJ2RehearsalToken.sol";

interface VmJ2Refund {
    function envUint(string calldata name) external returns (uint256);
    function envBytes32(string calldata name) external returns (bytes32);
    function envAddress(string calldata name) external returns (address);
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract StageJ2RefundDeploy {
    VmJ2Refund private constant vm = VmJ2Refund(address(uint160(uint256(keccak256("hevm cheat code")))));

    struct Context {
        uint256 deployerKey;
        uint256 outcomeKey;
        uint256 organizerKey;
        uint256 resolverKey;
        uint256 prize;
        uint256 deadline;
        address alice;
        address bob;
        address carol;
        address refundRecipient;
        StageJ2RehearsalToken token;
    }

    struct Tree {
        bytes32 leafA;
        bytes32 leafB;
        bytes32 leafC;
        bytes32 branchAB;
        bytes32 branchCC;
        bytes32 root;
    }

    function run() external returns (TestnetChallengeVault vault) {
        Context memory context = _context();

        vm.startBroadcast(context.deployerKey);
        vault = _deploy(context);
        require(context.token.approve(address(vault), context.prize), "approve failed");
        vault.fund();

        Tree memory tree = _tree(vault, context);
        _sealPayout(context, vault, tree);
        _sealZeroQualifiers(context, vault);
        _settleRefund(context, vault);

        require(vault.isFinalized(), "refund vault not finalized");
        require(context.token.balanceOf(context.refundRecipient) == context.prize, "refund balance mismatch");
        vm.stopBroadcast();
    }

    function _context() internal returns (Context memory context) {
        context.deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        context.outcomeKey = vm.envUint("J2_OUTCOME_PRIVATE_KEY");
        context.organizerKey = vm.envUint("J2_ORGANIZER_PRIVATE_KEY");
        context.resolverKey = vm.envUint("J2_RESOLVER_PRIVATE_KEY");
        context.prize = vm.envUint("J2_PRIZE_AMOUNT");
        context.deadline = vm.envUint("J2_SELECTION_DEADLINE_SECONDS");
        context.alice = vm.envAddress("J2_BUILDER_A");
        context.bob = vm.envAddress("J2_BUILDER_B");
        context.carol = vm.envAddress("J2_BUILDER_C");
        context.refundRecipient = vm.envAddress("J2_REFUND_RECIPIENT");
        context.token = StageJ2RehearsalToken(vm.envAddress("J2_TOKEN_ADDRESS"));

        require(vm.addr(context.outcomeKey) == vm.envAddress("J2_OUTCOME_AUTHORITY"), "outcome authority mismatch");
        require(
            vm.addr(context.organizerKey) == vm.envAddress("J2_ORGANIZER_AUTHORITY"),
            "organizer authority mismatch"
        );
        require(vm.addr(context.resolverKey) == vm.envAddress("J2_RESOLVER_AUTHORITY"), "resolver authority mismatch");
    }

    function _deploy(Context memory context) internal returns (TestnetChallengeVault) {
        return new TestnetChallengeVault(
            IERC20Minimal(address(context.token)),
            vm.envBytes32("J2_CHALLENGE_DIGEST"),
            vm.envBytes32("J2_TERMS_DIGEST"),
            vm.envBytes32("J2_BINDING_DIGEST"),
            context.prize,
            context.deadline,
            context.refundRecipient,
            vm.envAddress("J2_OUTCOME_AUTHORITY"),
            vm.envAddress("J2_ORGANIZER_AUTHORITY"),
            vm.envAddress("J2_RESOLVER_AUTHORITY")
        );
    }

    function _tree(TestnetChallengeVault vault, Context memory context)
        internal
        pure
        returns (Tree memory tree)
    {
        tree.leafA = vault.payoutLeaf(sha256(bytes("E-A")), 0, context.alice);
        tree.leafB = vault.payoutLeaf(sha256(bytes("E-B")), 1, context.bob);
        tree.leafC = vault.payoutLeaf(sha256(bytes("E-C")), 2, context.carol);
        tree.branchAB = vault.merklePair(tree.leafA, tree.leafB);
        tree.branchCC = vault.merklePair(tree.leafC, tree.leafC);
        tree.root = vault.merklePair(tree.branchAB, tree.branchCC);
    }

    function _sealPayout(Context memory context, TestnetChallengeVault vault, Tree memory tree) internal {
        bytes32 digest = vault.payoutSetAuthorizationDigest(tree.root, 3);
        vault.sealPayoutSet(tree.root, 3, _sign(context.outcomeKey, digest), _sign(context.organizerKey, digest));
    }

    function _sealZeroQualifiers(Context memory context, TestnetChallengeVault vault) internal {
        TestnetChallengeVault.PayoutMemberInput[] memory none =
            new TestnetChallengeVault.PayoutMemberInput[](0);
        bytes32 digest = vault.qualifierSetAuthorizationDigest(
            bytes32(0),
            0,
            TestnetChallengeVault.QualifierSetCoAuthority.RESOLVER
        );
        vault.sealQualifierSet(
            none,
            TestnetChallengeVault.QualifierSetCoAuthority.RESOLVER,
            _sign(context.outcomeKey, digest),
            _sign(context.resolverKey, digest)
        );
    }

    function _settleRefund(Context memory context, TestnetChallengeVault vault) internal {
        bytes32 manifestDigest = vm.envBytes32("J2_REFUND_MANIFEST_DIGEST");
        bytes32 recipientsDigest =
            vault.singleRecipientDigest(bytes32(0), 0, context.refundRecipient, context.prize);
        bytes32 digest = vault.settlementAuthorizationDigest(
            manifestDigest,
            bytes32(0),
            TestnetChallengeVault.SettlementKind.REFUND_NO_QUALIFIER,
            recipientsDigest
        );
        vault.authorizeNoQualifierRefund(manifestDigest, _sign(context.outcomeKey, digest));
        vault.claimFor(context.refundRecipient);
    }

    function _sign(uint256 privateKey, bytes32 digest) internal returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
