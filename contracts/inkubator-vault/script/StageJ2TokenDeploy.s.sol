// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {StageJ2RehearsalToken} from "../src/StageJ2RehearsalToken.sol";

interface VmJ2Token {
    function envUint(string calldata name) external returns (uint256);
    function addr(uint256 privateKey) external returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract StageJ2TokenDeploy {
    VmJ2Token private constant vm = VmJ2Token(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (StageJ2RehearsalToken token) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 prizeAmount = vm.envUint("J2_PRIZE_AMOUNT");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        token = new StageJ2RehearsalToken(deployer, prizeAmount * 3);
        vm.stopBroadcast();
    }
}
