// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

contract ProductionCandidateKnownAnswerTest {
    bytes32 private constant CHALLENGE =
        0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;
    bytes32 private constant TERMS =
        0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb;
    bytes32 private constant BINDING =
        0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc;
    bytes32 private constant ENTRY_A =
        0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd;
    bytes32 private constant ENTRY_B =
        0x4444444444444444444444444444444444444444444444444444444444444444;
    bytes32 private constant DEFAULT_MANIFEST =
        0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee;
    bytes32 private constant WINNER_MANIFEST =
        0x9999999999999999999999999999999999999999999999999999999999999999;

    address private constant VAULT = 0x1111111111111111111111111111111111111111;
    address private constant PAYOUT_A = 0x2222222222222222222222222222222222222222;
    address private constant PAYOUT_B = 0x3333333333333333333333333333333333333333;

    uint256 private constant CHAIN_ID = 57073;
    uint256 private constant AMOUNT = 1_234_567;

    bytes32 private constant EXPECTED_DOMAIN =
        0x204531b5999ca51070b22a39919156f03fbd230b8bbae0cc64e73217a5f336fc;
    bytes32 private constant EXPECTED_LEAF_A =
        0x281a7222c0e843ba2a41febded46e963bf6cde4ba6697bcfa51c6537e7b8f643;
    bytes32 private constant EXPECTED_LEAF_B =
        0x2253be8e577fb53a76895f2866840e7ff437a9302922fbe7fbbe6f3f031b2bc2;
    bytes32 private constant EXPECTED_PAYOUT_ROOT =
        0x0195b69843ca1d3cc2e4bfdb67b9a5d3c0719929a033f045db6d90095cf0312d;
    bytes32 private constant EXPECTED_PAYOUT_SET_DIGEST =
        0xa1f6397f2ba892b494c657bc6a183ec44183a2ed8be3a62b9f8ecd5ae5202e19;
    bytes32 private constant EXPECTED_QUALIFIER_SET_DIGEST =
        0xfd1656fab8c2c886907ad90e2653f37eafd7da10244871054c8dea25ac7cf138;
    bytes32 private constant EXPECTED_RECIPIENT_ITEM_HASH =
        0x179ddcabd1fff8ca39c9924d568488bb6d12077423dfc583f6d17c6757ec8203;
    bytes32 private constant EXPECTED_RECIPIENTS_DIGEST =
        0xab2d83a02e24a7c6929b27bfb460790b593b9acba9325c4ce4eccc478434fa0d;
    bytes32 private constant EXPECTED_ORGANIZER_WINNER_DIGEST =
        0x8244a6f57602be276724496196eebca9bbcaaa216145be78d2d8991c09446fc8;

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH =
        keccak256("REKT Inkubator Production Candidate Challenge Vault");
    bytes32 private constant VERSION_HASH = keccak256("1");
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

    function testKnownAnswerPayoutLeafAndRoot() public pure {
        bytes32 leafA = keccak256(abi.encodePacked(bytes1(0x00), ENTRY_A, uint16(0), PAYOUT_A));
        bytes32 leafB = keccak256(abi.encodePacked(bytes1(0x00), ENTRY_B, uint16(1), PAYOUT_B));
        require(leafA == EXPECTED_LEAF_A, "leaf A drift");
        require(leafB == EXPECTED_LEAF_B, "leaf B drift");

        bytes32 root = _pair(leafA, leafB);
        require(root == EXPECTED_PAYOUT_ROOT, "payout root drift");
    }

    function testKnownAnswerDomainAndPayoutSetDigest() public pure {
        bytes32 domain = _domain();
        require(domain == EXPECTED_DOMAIN, "domain drift");

        bytes32 structHash =
            keccak256(abi.encode(PAYOUT_SET_TYPEHASH, CHALLENGE, TERMS, BINDING, EXPECTED_PAYOUT_ROOT, uint16(2)));
        require(_typed(domain, structHash) == EXPECTED_PAYOUT_SET_DIGEST, "payout-set digest drift");
    }

    function testKnownAnswerQualifierSetDigest() public pure {
        bytes32 structHash = keccak256(
            abi.encode(
                QUALIFIER_SET_TYPEHASH,
                CHALLENGE,
                TERMS,
                BINDING,
                EXPECTED_PAYOUT_ROOT,
                EXPECTED_LEAF_A,
                uint16(1),
                DEFAULT_MANIFEST,
                bytes32(0),
                uint8(0)
            )
        );
        require(_typed(_domain(), structHash) == EXPECTED_QUALIFIER_SET_DIGEST, "qualifier digest drift");
    }

    function testKnownAnswerOrganizerWinnerDigest() public pure {
        bytes32 recipientItemHash = keccak256(abi.encode(ENTRY_A, uint16(0), PAYOUT_A, AMOUNT));
        require(recipientItemHash == EXPECTED_RECIPIENT_ITEM_HASH, "recipient item drift");

        bytes32 recipientsDigest = keccak256(abi.encode(keccak256(""), recipientItemHash));
        require(recipientsDigest == EXPECTED_RECIPIENTS_DIGEST, "recipients digest drift");

        bytes32 structHash = keccak256(
            abi.encode(
                SETTLEMENT_TYPEHASH,
                CHALLENGE,
                TERMS,
                BINDING,
                WINNER_MANIFEST,
                EXPECTED_LEAF_A,
                uint8(0),
                recipientsDigest
            )
        );
        require(_typed(_domain(), structHash) == EXPECTED_ORGANIZER_WINNER_DIGEST, "winner digest drift");
    }

    function _domain() internal pure returns (bytes32) {
        return keccak256(abi.encode(EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, CHAIN_ID, VAULT));
    }

    function _typed(bytes32 domain, bytes32 structHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(bytes2(0x1901), domain, structHash));
    }

    function _pair(bytes32 left, bytes32 right) internal pure returns (bytes32) {
        if (uint256(left) > uint256(right)) (left, right) = (right, left);
        return keccak256(abi.encodePacked(bytes1(0x01), left, right));
    }
}
