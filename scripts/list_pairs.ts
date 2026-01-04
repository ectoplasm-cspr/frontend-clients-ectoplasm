import { DexClient } from '../src/dex-client';
import { config } from '../src/contexts/DexContext';

async function main() {
    console.log('🔍 Fetching all existing pairs from Factory...\n');

    const dex = new DexClient({
        nodeUrl: import.meta.env.NODE_ADDRESS,
        chainName: import.meta.env.CHAIN_NAME,
        routerPackageHash: import.meta.env.ROUTER_PACKAGE_HASH,
        routerContractHash: import.meta.env.ROUTER_CONTRACT_HASH,
        factoryHash: import.meta.env.FACTORY_CONTRACT_HASH,
        tokens: {
            WCSPR: {
                packageHash: import.meta.env.WCSPR_PACKAGE_HASH,
                contractHash: import.meta.env.WCSPR_CONTRACT_HASH,
                decimals: 18,
            },
            ECTO: {
                packageHash: import.meta.env.ECTO_PACKAGE_HASH,
                contractHash: import.meta.env.ECTO_CONTRACT_HASH,
                decimals: 18,
            },
        },
        pairs: {}
    });

    const pairs = await dex.getAllPairs();

    console.log(`📊 Found ${pairs.length} pair(s):\n`);

    if (pairs.length === 0) {
        console.log('⚠️  No liquidity pools exist yet!');
        console.log('\nTo create a pool, use the Liquidity tab to add liquidity for a token pair.');
    } else {
        pairs.forEach((pair, index) => {
            console.log(`${index + 1}. ${pair}`);
        });

        console.log('\n✅ You can now enable these pairs in the UI!');
    }
}

main().catch(console.error);
