// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

contract LendPoolStorageExt {
  // !!! Add new variable MUST append it only, do not insert, update type & name, or change order !!!
  // https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable#potentially-unsafe-operations

  mapping(address => bool) internal _interceptors;

  // For upgradable, add one new variable above, minus 1 at here
  uint256[49] private __gap;
}
