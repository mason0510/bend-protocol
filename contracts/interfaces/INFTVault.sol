// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

interface INFTVault {
  event Deposit(
    address indexed user,
    address indexed nftAsset,
    uint256 nftTokenId,
    uint256 indexed receiptId,
    uint256 referralCode
  );

  event Withdraw(address indexed user, address indexed nftAsset, uint256 nftTokenId, uint256 indexed receiptId);

  enum ReceiptState {
    // This is the zero value
    None,
    // NFT have been delivered to the vault.
    Active,
    // This is a terminal state.
    Close
  }

  struct ReceiptData {
    //the id of the nft receipt
    uint256 receiptId;
    ReceiptState state;
    uint256 createTime;
    address nftAsset;
    uint256 nftTokenId;
  }

  function deposit(
    address[] calldata nftAssets,
    uint256[] calldata nftTokenIds,
    uint256 referralCode
  ) external;

  function withdraw(address[] calldata nftAssets, uint256[] calldata nftTokenIds) external;
}
