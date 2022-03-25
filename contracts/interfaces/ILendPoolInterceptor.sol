// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

/**
 * @title ILendPoolInterceptor interface
 * @notice Interface for the ILendPoolInterceptor.
 * @author BEND
 * @dev implement this interface to develop a interceptor-compatible contract
 **/
interface ILendPoolInterceptor {
  function preCheckAuction(
    address nftAsset,
    uint256 nftTokenId,
    uint256 bidPrice,
    address onBehalfOf
  ) external returns (bool);
}
