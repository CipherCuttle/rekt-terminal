// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {TestnetChallengeVault} from "../src/TestnetChallengeVault.sol";
import {StageJ2RehearsalToken} from "../src/StageJ2RehearsalToken.sol";

interface VmJ2Settle {
    function envUint(string calldata name) external returns (uint256);
    function envBytes32(string calldata name) external returns (bytes32);
    function envAddress(string calldata name) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract StageJ2DefaultSettle {
    VmJ2Settle private constant vm = VmJ2Settle(address(uint160(uint256(keccak256("hevm cheat code")))));

    struct Context {
        uint256 deployerPrivateKey;
        uint256 outcomePrivateKey;
        uint256 prizeAmount;
        uint256 deadline;
        TestnetChallengeVault vault;
        StageJ2RehearsalToken token;
        address alice;
        address bob;
        address carol;
        bytes32 manifestDigest;
    }

    function run() external {
        Context memory context = _context();
        require(block.timestamp >= context.deadline, "J2 default deadline not reached");

        TestnetChallengeVault.RecipientClaimInput[] memory recipients = _recipients(context);
        bytes32 recipientsDigest = _recipientDigest(context.vault, recipients);
        bytes32 digest = context.vault.settlementAuthorizationDigest(
            context.manifestDigest,
            context.vault.qualifierSetRoot(),
            TestnetChallengeVault.SettlementKind.DEFAULT_DISTRIBUTION,
            recipientsDigest
        );

        vm.startBroadcast(context.deployerPrivateKey);
        context.vault.authorizeDefaultDistribution(
            context.manifestDigest,
            recipients,
            _sign(context.outcomePrivateKey, digest)
        );
        context.vault.claimFor(context.alice);
        context.vault.claimFor(context.bob);
        context.vault.claimFor(context.carol);
        vm.stopBroadcast();

        require(context.vault.isFinalized(), "J2 default vault not finalized");
        require(context.token.balanceOf(address(context.vault)) == 0, "J2 default vault token balance not zero");
    }

    function _context() internal returns (Context memory context) {
        context.deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        context.outcomePrivateKey = vm.envUint("J2_OUTCOME_PRIVATE_KEY");
        context.prizeAmount = vm.envUint("J2_PRIZE_AMOUNT");
        context.deadline = vm.envUint("J2_SELECTION_DEADLINE_SECONDS");
        context.vault = TestnetChallengeVault(vm.envAddress("J2_DEFAULT_VAULT"));
        context.token = StageJ2RehearsalToken(vm.envAddress("J2_TOKEN_ADDRESS"));
        context.alice = vm.envAddress("J2_BUILDER_A");
        context.bob = vm.envAddress("J2_BUILDER_B");
        context.carol = vm.envAddress("J2_BUILDER_C");
        context.manifestDigest = vm.envBytes32("J2_DEFAULT_MANIFEST_DIGEST");
    }

    function _recipients(Context memory context)
        internal
        view
        returns (TestnetChallengeVault.RecipientClaimInput[] memory recipients)
    {
        bytes32 leafA = context.vault.payoutLeaf(sha256(bytes("E-A")), 0, context.alice);
        bytes32 leafB = context.vault.payoutLeaf(sha256(bytes("E-B")), 1, context.bob);
        bytes32 leafC = context.vault.payoutLeaf(sha256(bytes("E-C")), 2, context.carol);
        bytes32 branchAB = context.vault.merklePair(leafA, leafB);
        bytes32 branchCC = context.vault.merklePair(leafC, leafC);

        bytes32[] memory proofA = new bytes32[](2);
        proofA[0] = leafB;
        proofA[1] = branchCC;
        bytes32[] memory proofB = new bytes32[](2);
        proofB[0] = leafA;
        proofB[1] = branchCC;
        bytes32[] memory proofC = new bytes32[](2);
        proofC[0] = leafC;
        proofC[1] = branchAB;

        uint256 base = context.prizeAmount / 3;
        uint256 remainder = context.prizeAmount % 3;

        recipients = new TestnetChallengeVault.RecipientClaimInput[](3);
        recipients[0] = TestnetChallengeVault.RecipientClaimInput(
            sha256(bytes("E-A")),
            0,
            context.alice,
            base + (remainder > 0 ? 1 : 0),
            proofA
        );
        recipients[1] = TestnetChallengeVault.RecipientClaimInput(
            sha256(bytes("E-B")),
            1,
            context.bob,
            base + (remainder > 1 ? 1 : 0),
            proofB
        );
        recipients[2] = TestnetChallengeVault.RecipientClaimInput(
            sha256(bytes("E-C")),
            2,
            context.carol,
            base + (remainder > 2 ? 1 : 0),
            proofC
        );
    }

    function _recipientDigest(
        TestnetChallengeVault vault,
        TestnetChallengeVault.RecipientClaimInput[] memory recipients
    ) internal view returns (bytes32 digest) {
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
}
