// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ITestERC1155 {
    function mint(address recipient, uint256 tokenId) external;
}