// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";

import "../interfaces/IBNFTRegistry.sol";
import "../interfaces/IBNFT.sol";
import "../interfaces/INFTVault.sol";

contract NFTVault is INFTVault, Initializable, ContextUpgradeable, ERC721HolderUpgradeable {
  using CountersUpgradeable for CountersUpgradeable.Counter;

  IBNFTRegistry public bnftRegistry;

  CountersUpgradeable.Counter internal _receiptIdTracker;
  mapping(uint256 => ReceiptData) internal _receipts;

  // nftAsset + nftTokenId => receiptId
  mapping(address => mapping(uint256 => uint256)) internal _nftToReceiptIds;

  // called once by the factory at time of deployment
  function initialize(address bnftRegistry_) external initializer {
    __Context_init();
    __ERC721Holder_init();

    bnftRegistry = IBNFTRegistry(bnftRegistry_);

    // Avoid having id = 0
    _receiptIdTracker.increment();
  }

  function deposit(address[] calldata nftAssets, uint256[] calldata nftTokenIds) external override {
    require(nftAssets.length == nftTokenIds.length, "NFTV: inconsistent params");

    for (uint256 i = 0; i < nftAssets.length; i++) {
      _deposit(nftAssets[i], nftTokenIds[i]);
    }
  }

  function _deposit(address nftAsset, uint256 nftTokenId) internal {
    require(_nftToReceiptIds[nftAsset][nftTokenId] == 0, "NFTV: nft already exist");

    (address bNftProxy, ) = bnftRegistry.getBNFTAddresses(nftAsset);
    require(bNftProxy != address(0), "NFTV: invalid nft asset");

    uint256 receiptId = _receiptIdTracker.current();
    _receiptIdTracker.increment();

    _nftToReceiptIds[nftAsset][nftTokenId] = receiptId;

    // transfer underlying NFT asset to pool and mint bNFT to _msgSender()
    IERC721Upgradeable(nftAsset).safeTransferFrom(_msgSender(), address(this), nftTokenId);

    IBNFT(bNftProxy).mint(_msgSender(), nftTokenId);

    // Save Info
    ReceiptData storage receiptData = _receipts[receiptId];
    receiptData.receiptId = receiptId;
    receiptData.state = ReceiptState.Active;
    receiptData.createTime = block.timestamp;
    receiptData.nftAsset = nftAsset;
    receiptData.nftTokenId = nftTokenId;

    emit Deposit(_msgSender(), nftAsset, nftTokenId, receiptId);
  }

  function withdraw(address[] calldata nftAssets, uint256[] calldata nftTokenIds) external override {
    require(nftAssets.length == nftTokenIds.length, "NFTV: inconsistent params");

    for (uint256 i = 0; i < nftAssets.length; i++) {
      _withdraw(nftAssets[i], nftTokenIds[i]);
    }
  }

  function _withdraw(address nftAsset, uint256 nftTokenId) internal {
    uint256 receiptId = _nftToReceiptIds[nftAsset][nftTokenId];
    require(receiptId != 0, "NFTV: nft not exist");

    (address bNftProxy, ) = bnftRegistry.getBNFTAddresses(nftAsset);
    require(bNftProxy != address(0), "NFTV: invalid nft asset");

    // Must use storage to change state
    ReceiptData storage receiptData = _receipts[receiptId];

    // Ensure valid loan state
    require(receiptData.state == ReceiptState.Active, "NFTV: invalid state");

    // state changes and cleanup
    // NOTE: these must be performed before assets are released to prevent reentrance
    receiptData.state = ReceiptState.Close;

    _nftToReceiptIds[receiptData.nftAsset][receiptData.nftTokenId] = 0;

    // burn bNFT and transfer underlying NFT asset to user
    IBNFT(bNftProxy).burn(receiptData.nftTokenId);

    IERC721Upgradeable(receiptData.nftAsset).safeTransferFrom(address(this), _msgSender(), receiptData.nftTokenId);

    emit Withdraw(_msgSender(), receiptData.nftAsset, receiptData.nftTokenId, receiptId);
  }
}
