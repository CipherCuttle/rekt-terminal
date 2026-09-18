// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IERC20Minimal} from "./TestnetChallengeVault.sol";

/// @notice Disposable fixed-supply token used only by the Stage-J2 Ink Sepolia rehearsal.
contract StageJ2RehearsalToken is IERC20Minimal {
    string public constant name = "REKT J2 Test USDC";
    string public constant symbol = "J2USDC";
    uint8 public constant decimals = 6;

    uint256 public immutable totalSupply;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(address recipient, uint256 supply) {
        require(recipient != address(0), "zero recipient");
        require(supply != 0, "zero supply");
        totalSupply = supply;
        balanceOf[recipient] = supply;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        allowance[from][msg.sender] = allowed - amount;
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        require(to != address(0), "zero recipient");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}
