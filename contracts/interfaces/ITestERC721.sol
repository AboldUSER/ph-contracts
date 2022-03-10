// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ITestERC721 {
    //Types
    // 1 staking
    // 2 offset
    // 3 steal
    // 4 protect high
    // 5 protect mid
    // 6 protect low
    // function mint() external;
    // function balanceOf(address) external view returns (uint256);
    // function tokenBalance(address) external view returns (uint256);

    function balanceOf(address) external view returns (uint256);

    function getNFTOwners(uint256) external view returns (address[] memory);

    function batchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _tokenIds
    ) external;
    function batchSafeTransferFrom(
        address _from,
        address _to,
        uint256[] memory _tokenIds,
        bytes memory _data
    ) external;
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) external;

    // function getNFTType(uint256) external view returns(address, bytes32);
    // function tokenType(uint256) external view returns(bytes32);
    // function getAlfaOwners() external view returns(address[] memory);
    // function tokenGenerationTimestamp(uint256) external view returns(uint256);
}
