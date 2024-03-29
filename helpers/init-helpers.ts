import {
  eContractid,
  eNetwork,
  iMultiPoolsAssets,
  IReserveParams,
  iMultiPoolsNfts,
  INftParams,
  tEthereumAddress,
} from "./types";
import { chunk, waitForTx } from "./misc-utils";
import {
  getLendPoolAddressesProvider,
  getLendPoolConfiguratorProxy,
  getBTokensAndBNFTsHelper,
  getBNFTRegistryProxy,
} from "./contracts-getters";
import { getContractAddressWithJsonFallback, rawInsertContractAddressInDb } from "./contracts-helpers";
import { BigNumberish } from "ethers";
import { ConfigNames } from "./configuration";
import { deployRateStrategy } from "./contracts-deployments";
import { BNFTRegistry } from "../types";

export const getBTokenExtraParams = async (bTokenName: string, tokenAddress: tEthereumAddress) => {
  //console.log(bTokenName);
  switch (bTokenName) {
    default:
      return "0x10";
  }
};

export const initReservesByHelper = async (
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: { [symbol: string]: tEthereumAddress },
  bTokenNamePrefix: string,
  bTokenSymbolPrefix: string,
  debtTokenNamePrefix: string,
  debtTokenSymbolPrefix: string,
  admin: tEthereumAddress,
  treasuryAddress: tEthereumAddress,
  poolName: ConfigNames,
  verify: boolean
) => {
  const addressProvider = await getLendPoolAddressesProvider();

  // CHUNK CONFIGURATION
  const initChunks = 1;

  // Initialize variables for future reserves initialization
  let reserveSymbols: string[] = [];

  let initInputParams: {
    bTokenImpl: string;
    debtTokenImpl: string;
    underlyingAssetDecimals: BigNumberish;
    interestRateAddress: string;
    underlyingAsset: string;
    treasury: string;
    underlyingAssetName: string;
    bTokenName: string;
    bTokenSymbol: string;
    debtTokenName: string;
    debtTokenSymbol: string;
  }[] = [];

  let strategyRates: [
    string, // addresses provider
    string,
    string,
    string,
    string
  ];
  let rateStrategies: Record<string, typeof strategyRates> = {};
  let strategyAddresses: Record<string, tEthereumAddress> = {};

  const reserves = Object.entries(reservesParams);

  for (let [symbol, params] of reserves) {
    if (!tokenAddresses[symbol]) {
      console.log(`- Skipping init of ${symbol} due token address is not set at markets config`);
      continue;
    }
    const { strategy, bTokenImpl, reserveDecimals } = params;
    const { optimalUtilizationRate, baseVariableBorrowRate, variableRateSlope1, variableRateSlope2 } = strategy;
    if (!strategyAddresses[strategy.name]) {
      // Strategy does not exist, create a new one
      rateStrategies[strategy.name] = [
        addressProvider.address,
        optimalUtilizationRate,
        baseVariableBorrowRate,
        variableRateSlope1,
        variableRateSlope2,
      ];
      strategyAddresses[strategy.name] = await deployRateStrategy(strategy.name, rateStrategies[strategy.name], verify);

      // This causes the last strategy to be printed twice, once under "DefaultReserveInterestRateStrategy"
      // and once under the actual `strategyASSET` key.
      rawInsertContractAddressInDb(strategy.name, strategyAddresses[strategy.name]);
    }
    // Prepare input parameters
    reserveSymbols.push(symbol);
    const bTokenImplContractAddr = await getContractAddressWithJsonFallback(bTokenImpl, poolName);
    const debtTokenImplContractAddr = await getContractAddressWithJsonFallback(eContractid.DebtToken, poolName);
    const initParam = {
      bTokenImpl: bTokenImplContractAddr,
      debtTokenImpl: debtTokenImplContractAddr,
      underlyingAssetDecimals: reserveDecimals,
      interestRateAddress: strategyAddresses[strategy.name],
      underlyingAsset: tokenAddresses[symbol],
      treasury: treasuryAddress,
      underlyingAssetName: symbol,
      bTokenName: `${bTokenNamePrefix} ${symbol}`,
      bTokenSymbol: `${bTokenSymbolPrefix}${symbol}`,
      debtTokenName: `${debtTokenNamePrefix} ${symbol}`,
      debtTokenSymbol: `${debtTokenSymbolPrefix}${symbol}`,
    };
    initInputParams.push(initParam);
    //console.log("initInputParams:", symbol, bTokenImpl, initParam);
  }

  // Deploy init reserves per chunks
  const chunkedSymbols = chunk(reserveSymbols, initChunks);
  const chunkedInitInputParams = chunk(initInputParams, initChunks);

  const configurator = await getLendPoolConfiguratorProxy();

  console.log(`- Reserves initialization in ${chunkedInitInputParams.length} txs`);
  for (let chunkIndex = 0; chunkIndex < chunkedInitInputParams.length; chunkIndex++) {
    const tx3 = await waitForTx(await configurator.batchInitReserve(chunkedInitInputParams[chunkIndex]));

    console.log(
      `  - Reserve ready for: ${chunkedSymbols[chunkIndex].join(", ")}`,
      chunkedInitInputParams[chunkIndex][0].underlyingAsset
    );
    console.log("    * gasUsed", tx3.gasUsed.toString());
  }
};

export const getBNftExtraParams = async (bNftName: string, nftAddress: tEthereumAddress) => {
  //console.log(bNftName);
  switch (bNftName) {
    default:
      return "0x10";
  }
};

export const initNftsByHelper = async (
  nftsParams: iMultiPoolsNfts<INftParams>,
  nftAddresses: { [symbol: string]: tEthereumAddress },
  admin: tEthereumAddress,
  poolName: ConfigNames,
  verify: boolean
) => {
  const addressProvider = await getLendPoolAddressesProvider();
  const bnftRegistry = await addressProvider.getBNFTRegistry();

  // CHUNK CONFIGURATION
  const initChunks = 1;

  // Initialize variables for future nfts initialization
  let nftSymbols: string[] = [];

  let initInputParams: {
    underlyingAsset: string;
  }[] = [];

  const nfts = Object.entries(nftsParams);

  for (let [symbol, params] of nfts) {
    if (!nftAddresses[symbol]) {
      console.log(`- Skipping init of ${symbol} due nft address is not set at markets config`);
      continue;
    }

    const initParam = {
      underlyingAsset: nftAddresses[symbol],
    };

    // Prepare input parameters
    nftSymbols.push(symbol);
    initInputParams.push(initParam);
  }

  // Deploy init nfts per chunks
  const chunkedSymbols = chunk(nftSymbols, initChunks);
  const chunkedInitInputParams = chunk(initInputParams, initChunks);

  const configurator = await getLendPoolConfiguratorProxy();

  console.log(`- NFTs initialization in ${chunkedInitInputParams.length} txs`);
  for (let chunkIndex = 0; chunkIndex < chunkedInitInputParams.length; chunkIndex++) {
    const tx3 = await waitForTx(await configurator.batchInitNft(chunkedInitInputParams[chunkIndex]));

    console.log(
      `  - NFT ready for: ${chunkedSymbols[chunkIndex].join(", ")}`,
      chunkedInitInputParams[chunkIndex][0].underlyingAsset
    );
    console.log("    * gasUsed", tx3.gasUsed.toString());
  }
};

export const getPairsTokenAggregator = (
  allAssetsAddresses: {
    [tokenSymbol: string]: tEthereumAddress;
  },
  aggregatorsAddresses: { [tokenSymbol: string]: tEthereumAddress }
): [string[], string[]] => {
  const { ETH, WETH, ...assetsAddressesWithoutEth } = allAssetsAddresses;

  const pairs = Object.entries(assetsAddressesWithoutEth).map(([tokenSymbol, tokenAddress]) => {
    if (tokenSymbol !== "WETH" && tokenSymbol !== "ETH") {
      const aggregatorAddressIndex = Object.keys(aggregatorsAddresses).findIndex((value) => value === tokenSymbol);
      const [, aggregatorAddress] = (Object.entries(aggregatorsAddresses) as [string, tEthereumAddress][])[
        aggregatorAddressIndex
      ];
      return [tokenAddress, aggregatorAddress];
    }
  }) as [string, string][];

  const mappedPairs = pairs.map(([asset]) => asset);
  const mappedAggregators = pairs.map(([, source]) => source);

  return [mappedPairs, mappedAggregators];
};

export const configureReservesByHelper = async (
  reservesParams: iMultiPoolsAssets<IReserveParams>,
  tokenAddresses: { [symbol: string]: tEthereumAddress },
  admin: tEthereumAddress
) => {
  const addressProvider = await getLendPoolAddressesProvider();
  const tokenHelperDeployer = await getBTokensAndBNFTsHelper();
  const tokens: string[] = [];
  const symbols: string[] = [];

  const inputParams: {
    asset: string;
    reserveFactor: BigNumberish;
    borrowingEnabled: boolean;
  }[] = [];

  console.log(`- Configure Reserves`);
  for (const [assetSymbol, { reserveFactor, borrowingEnabled }] of Object.entries(reservesParams) as [
    string,
    IReserveParams
  ][]) {
    if (!tokenAddresses[assetSymbol]) {
      console.log(`- Skipping init of ${assetSymbol} due token address is not set at markets config`);
      continue;
    }

    const assetAddressIndex = Object.keys(tokenAddresses).findIndex((value) => value === assetSymbol);
    const [, tokenAddress] = (Object.entries(tokenAddresses) as [string, string][])[assetAddressIndex];
    // Push data

    inputParams.push({
      asset: tokenAddress,
      reserveFactor: reserveFactor,
      borrowingEnabled: borrowingEnabled,
    });

    tokens.push(tokenAddress);
    symbols.push(assetSymbol);

    console.log(`  - Params for ${assetSymbol}:`, reserveFactor, borrowingEnabled);
  }
  if (tokens.length) {
    // Set helpDeployer as temporal admin
    await waitForTx(await addressProvider.setPoolAdmin(tokenHelperDeployer.address));

    // Deploy init per chunks
    const enableChunks = 20;
    const chunkedSymbols = chunk(symbols, enableChunks);
    const chunkedInputParams = chunk(inputParams, enableChunks);

    console.log(`- Configure reserves in ${chunkedInputParams.length} txs`);
    for (let chunkIndex = 0; chunkIndex < chunkedInputParams.length; chunkIndex++) {
      await waitForTx(await tokenHelperDeployer.configureReserves(chunkedInputParams[chunkIndex]));
      console.log(`  - Init for: ${chunkedSymbols[chunkIndex].join(", ")}`);
    }
    // Set deployer back as admin
    await waitForTx(await addressProvider.setPoolAdmin(admin));
  }
};

export const configureNftsByHelper = async (
  nftsParams: iMultiPoolsNfts<INftParams>,
  nftAddresses: { [symbol: string]: tEthereumAddress },
  admin: tEthereumAddress
) => {
  const addressProvider = await getLendPoolAddressesProvider();
  const tokenHelperDeployer = await getBTokensAndBNFTsHelper();
  const tokens: string[] = [];
  const symbols: string[] = [];

  console.log("addressesProvider:", addressProvider.address);
  const addressProviderInHelper = await getLendPoolAddressesProvider(await tokenHelperDeployer.addressesProvider());
  console.log("addressProviderInHelper:", addressProviderInHelper.address);
  console.log("getLendPoolConfigurator:", await addressProviderInHelper.getLendPoolConfigurator());

  const inputParams: {
    asset: string;
    baseLTV: BigNumberish;
    liquidationThreshold: BigNumberish;
    liquidationBonus: BigNumberish;
    redeemDuration: BigNumberish;
    auctionDuration: BigNumberish;
    redeemFine: BigNumberish;
    redeemThreshold: BigNumberish;
  }[] = [];

  console.log(`- Configure NFTs`);
  for (const [
    assetSymbol,
    {
      baseLTVAsCollateral,
      liquidationBonus,
      liquidationThreshold,
      redeemDuration,
      auctionDuration,
      redeemFine,
      redeemThreshold,
    },
  ] of Object.entries(nftsParams) as [string, INftParams][]) {
    if (!nftAddresses[assetSymbol]) {
      console.log(`- Skipping init of ${assetSymbol} due nft address is not set at markets config`);
      continue;
    }
    if (baseLTVAsCollateral === "-1") continue;

    const assetAddressIndex = Object.keys(nftAddresses).findIndex((value) => value === assetSymbol);
    const [, tokenAddress] = (Object.entries(nftAddresses) as [string, string][])[assetAddressIndex];
    // Push data

    inputParams.push({
      asset: tokenAddress,
      baseLTV: baseLTVAsCollateral,
      liquidationThreshold: liquidationThreshold,
      liquidationBonus: liquidationBonus,
      redeemDuration: redeemDuration,
      auctionDuration: auctionDuration,
      redeemFine: redeemFine,
      redeemThreshold: redeemThreshold,
    });

    tokens.push(tokenAddress);
    symbols.push(assetSymbol);

    console.log(
      `  - Params for ${assetSymbol}:`,
      baseLTVAsCollateral,
      liquidationThreshold,
      liquidationBonus,
      redeemDuration,
      auctionDuration,
      redeemFine,
      redeemThreshold
    );
  }
  if (tokens.length) {
    // Set helpDeployer as temporal admin
    await waitForTx(await addressProvider.setPoolAdmin(tokenHelperDeployer.address));

    // Deploy init per chunks
    const enableChunks = 20;
    const chunkedSymbols = chunk(symbols, enableChunks);
    const chunkedInputParams = chunk(inputParams, enableChunks);

    console.log(`- Configure NFTs in ${chunkedInputParams.length} txs`);
    for (let chunkIndex = 0; chunkIndex < chunkedInputParams.length; chunkIndex++) {
      //console.log("configureNfts:", chunkedInputParams[chunkIndex]);
      await waitForTx(await tokenHelperDeployer.configureNfts(chunkedInputParams[chunkIndex]));
      console.log(`  - Init for: ${chunkedSymbols[chunkIndex].join(", ")}`);
    }
    // Set deployer back as admin
    await waitForTx(await addressProvider.setPoolAdmin(admin));
  }
};
