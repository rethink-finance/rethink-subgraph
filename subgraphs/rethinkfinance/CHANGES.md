# Changes Made to GovernableFundFactory Indexing

## Summary
Modified the indexer to handle GovernableFundFactory_CreatedAndInitializedFundEvent and set the GovernableFundFactory version (V1 or V2) based on the roles.

## Details

1. **Created separate handler files for each factory version**:
   - Created `GovernableFundFactoryV1.mapping.ts` for handling V1 factory events
   - Created `GovernableFundFactoryV2.mapping.ts` for handling V2 factory events

2. **Modified the handlers to set the factory version based on roles**:
   - Both handlers now check the `rolesModifier` address to determine the factory version
   - If `rolesModifier` is not the zero address, it sets `factoryVersion` to "V1"
   - If `rolesModifier` is the zero address, it sets `factoryVersion` to "V2"

3. **Updated all YAML configuration files**:
   - Updated `rethinkfinance-arbitrum-one.yaml`
   - Updated `rethinkfinance-mainnet.yaml`
   - Updated `subgraph.yaml`
   - Updated `rethinkfinance-base.yaml`
   - Updated `rethinkfinance-matic.yaml`
   - Changed all references to point to the appropriate version-specific handler

4. **Removed the original handler file**:
   - Removed `GovernableFundFactory.mapping.ts` as it's no longer needed
