// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {TestnetChallengeVault, IERC20Minimal} from "../src/TestnetChallengeVault.sol";
import {StageJ2RehearsalToken} from "../src/StageJ2RehearsalToken.sol";

interface VmJ2DefaultSetup {
    function envUint(string calldata name) external returns (uint256);
    function envBytes32(string calldata name) external returns (bytes32);
    function envAddress(string calldata name) external returns (address);
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract StageJ2DefaultSetup {
    VmJ2DefaultSetup private constant vm =
        VmJ2DefaultSetup(address(uint160(uint256(keccak256("hevm cheat code")))));

    struct Context {
        uint256 deployerKey;
        uint256 outcomeKey;
        uint256 organizerKey;
        uint256 prize;
        uint256 deadline;
        address alice;
        address bob;
        address carol;
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
        require(block.timestamp < context.deadline, "J2 organizer window expired");

        vm.startBroadcast(context.deployerKey);
        vault = _deploy(context);
        _fund(context, vault);
        Tree memory tree = _tree(vault, context);
        _sealPayout(context, vault, tree);
        _sealQualifiers(context, vault, tree);
        require(!vault.isFinalized(), "default vault finalized early");
        require(context.token.balanceOf(address(vault)) == context.prize, "default vault balance mismatch");
        vm.stopBroadcast();
    }

    function _context() internal returns (Context memory context) {
        context.deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        context.outcomeKey = vm.envUint("J2_OUTCOME_PRIVATE_KEY");
        context.organizerKey = vm.envUint("J2_ORGANIZER_PRIVATE_KEY");
        context.prize = vm.envUint("J2_PRIZE_AMOUNT");
        context.deadline = vm.envUint("J2_SELECTION_DEADLINE_SECONDS");
        context.alice = vm.envAddress("J2_BUILDER_A");
        context.bob = vm.envAddress("J2_BUILDER_B");
        context.carol = vm.envAddress("J2_BUILDER_C");
        context.token = StageJ2RehearsalToken(vm.envAddress("J2_TOKEN_ADDRESS"));

        require(vm.addr(context.outcomeKey) == vm.envAddress("J2_OUTCOME_AUTHORITY"), "outcome authority mismatch");
        require(
            vm.addr(context.organizerKey) == vm.envAddress("J2_ORGANIZER_AUTHORITY"),
            "organizer authority mismatch"
        );
    }

    function _deploy(Context memory context) internal returns (TestnetChallengeVault) {
        return new TestnetChallengeVault(
            IERC20Minimal(address(context.token)),
            vm.envBytes32("J2_CHALLENGE_DIGEST"),
            vm.envBytes32("J2_TERMS_DIGEST"),
            vm.envBytes32("J2_BINDING_DIGEST"),
            context.prize,
            context.deadline,
            vm.envAddress("J2_REFUND_RECIPIENT"),
            vm.envAddress("J2_OUTCOME_AUTHORITY"),
            vm.envAddress("J2_ORGANIZER_AUTHORITY"),
            vm.envAddress("J2_RESOLVER_AUTHORITY")
        );
    }

    function _fund(Context memory context, TestnetChallengeVault vault) internal {
        require(context.token.approve(address(vault), context.prize), "approve failed");
        vault.fund();
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

    function _sealQualifiers(Context memory context, TestnetChallengeVault vault, Tree memory tree) internal {
        bytes32[] memory proofA = new bytes32[](2);
        proofA[0] = tree.leafB;
        proofA[1] = tree.branchCC;
        bytes32[] memory proofB = new bytes32[](2);
        proofB[0] = tree.leafA;
        proofB[1] = tree.branchCC;
        bytes32[] memory proofC = new bytes32[](2);
        proofC[0] = tree.leafC;
        proofC[1] = tree.branchAB;

        TestnetChallengeVault.PayoutMemberInput[] memory qualifiers =
            new TestnetChallengeVault.PayoutMemberInput[](3);
        qualifiers[0] = TestnetChallengeVault.PayoutMemberInput(sha256(bytes("E-A")), 0, context.alice, proofA);
        qualifiers[1] = TestnetChallengeVault.PayoutMemberInput(sha256(bytes("E-B")), 1, context.bob, proofB);
        qualifiers[2] = TestnetChallengeVault.PayoutMemberInput(sha256(bytes("E-C")), 2, context.carol, proofC);

        bytes32 digest = vault.qualifierSetAuthorizationDigest(
            tree.root,
            3,
            TestnetChallengeVault.QualifierSetCoAuthority.ORGANIZER
        );
        vault.sealQualifierSet(
            qualifiers,
            TestnetChallengeVault.QualifierSetCoAuthority.ORGANIZER,
            _sign(context.outcomeKey, digest),
            _sign(context.organizerKey, digest)
        );
    }

    function _sign(uint256 privateKey, bytes32 digest) internal returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
