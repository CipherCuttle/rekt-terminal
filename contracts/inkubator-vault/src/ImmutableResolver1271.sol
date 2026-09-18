// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @notice Immutable verification-only 2-of-3 ERC-1271 resolver for Stage J4.
/// @dev No owner, mutation, module, delegatecall, custody, upgrade, or arbitrary execution surface.
contract ImmutableResolver1271 {
    bytes4 public constant MAGICVALUE = 0x1626ba7e;
    bytes4 public constant INVALID = 0xffffffff;
    uint256 private constant SECP256K1N_HALF =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    address public immutable signer1;
    address public immutable signer2;
    address public immutable signer3;

    error ZeroSigner();
    error DuplicateSigner();

    constructor(address signer1_, address signer2_, address signer3_) {
        if (signer1_ == address(0) || signer2_ == address(0) || signer3_ == address(0)) revert ZeroSigner();
        if (signer1_ == signer2_ || signer1_ == signer3_ || signer2_ == signer3_) revert DuplicateSigner();

        signer1 = signer1_;
        signer2 = signer2_;
        signer3 = signer3_;
    }

    function quorum() external pure returns (uint8) {
        return 2;
    }

    function isSigner(address candidate) public view returns (bool) {
        return candidate == signer1 || candidate == signer2 || candidate == signer3;
    }

    /// @notice Signature encoding is exactly two concatenated canonical 65-byte ECDSA signatures.
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        if (signature.length != 130) return INVALID;

        address first = _recoverAt(hash, signature, 0);
        address second = _recoverAt(hash, signature, 65);

        if (first == address(0) || second == address(0) || first == second) return INVALID;
        if (!isSigner(first) || !isSigner(second)) return INVALID;

        return MAGICVALUE;
    }

    function _recoverAt(bytes32 digest, bytes calldata signature, uint256 offset)
        internal
        pure
        returns (address signer)
    {
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := calldataload(add(signature.offset, offset))
            s := calldataload(add(add(signature.offset, offset), 32))
            v := byte(0, calldataload(add(add(signature.offset, offset), 64)))
        }

        if (uint256(s) > SECP256K1N_HALF || (v != 27 && v != 28)) return address(0);
        signer = ecrecover(digest, v, r, s);
    }
}
