// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

/**
 * @title ILendPoolInterceptor interface
 * @notice Interface for the ILendPoolInterceptor.
 * @author BEND
 * @dev implement this interface to develop a interceptor-compatible contract
 **/
interface ILendPoolInterceptor {
  function preHandleAuction(
    address nftAsset,
    uint256 nftTokenId,
    uint256 bidPrice,
    address onBehalfOf
  ) external returns (bool);

  function postHandleAuction(
    address nftAsset,
    uint256 nftTokenId,
    uint256 bidPrice,
    address onBehalfOf
  ) external returns (bool);

  function preHandleRedeem(
    address nftAsset,
    uint256 nftTokenId,
    uint256 amount
  ) external returns (bool);

  function postHandleRedeem(
    address nftAsset,
    uint256 nftTokenId,
    uint256 amount
  ) external returns (bool);

  function preHandleLiquidate(
    address nftAsset,
    uint256 nftTokenId,
    uint256 amount
  ) external returns (bool);

  function postHandleLiquidate(
    address nftAsset,
    uint256 nftTokenId,
    uint256 amount
  ) external returns (bool);
}
