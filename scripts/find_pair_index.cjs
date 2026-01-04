
const { blake2bHex } = require('blakejs');
const fetch = require('node-fetch');

const NODE_URL = 'http://65.109.83.79:7777/rpc';
const STATE_UREF = 'uref-ead5c7aa417f9f13b114fde8b1f1ec71b73f2c50f70202d3b7586122c0650c77-007';

// Token Hashes from .env
const WCSPR = 'hash-6adfa0f394cce4526c851136dc514d2d616102373a6e05abaaae1fd0f54a2c1b';
const ECTO = 'hash-2e52f8fe9ca9d7035ce8c2f84ab0780231226be612766448b878352ca4cd8903';

function serializeKey(keyStr) {
    let tag = 1;
    let clean = keyStr;
    if (keyStr.startsWith('account-hash-')) {
        tag = 0;
        clean = keyStr.replace('account-hash-', '');
    } else if (keyStr.startsWith('hash-')) {
        tag = 1;
        clean = keyStr.replace('hash-', '');
    }
    const bytes = new Uint8Array(33);
    bytes[0] = tag;
    const hashBytes = new Uint8Array(clean.match(/.{1,2}/g).map(b => parseInt(b, 16)));
    bytes.set(hashBytes, 1);
    return bytes;
}

function compareBytes(a, b) {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
    }
    return a.length - b.length;
}

async function main() {
    // Prepare Keys
    const keyA = serializeKey(WCSPR);
    const keyB = serializeKey(ECTO);

    let first = keyA;
    let second = keyB;
    if (compareBytes(keyA, keyB) > 0) {
        first = keyB;
        second = keyA;
    }

    const mappingKey = new Uint8Array(first.length + second.length);
    mappingKey.set(first);
    mappingKey.set(second, first.length);

    // Get State Root
    const srRes = await fetch(NODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'chain_get_state_root_hash', params: [] })
    }).then(r => r.json());
    const stateRoot = srRes.result.state_root_hash;

    console.log('Trying Indices 0 to 10...');

    for (let i = 0; i < 11; i++) {
        // Generate Key
        const indexBytes = new Uint8Array(4);
        new DataView(indexBytes.buffer).setUint32(0, i, false); // Big Endian

        // Try with Tag 0 (Standard Mapping)
        const tagBytes = new Uint8Array([0]);
        const combined = new Uint8Array(indexBytes.length + tagBytes.length + mappingKey.length);
        combined.set(indexBytes);
        combined.set(tagBytes, indexBytes.length);
        combined.set(mappingKey, indexBytes.length + tagBytes.length);

        const dictKey = blake2bHex(combined, undefined, 32);

        // Query
        const res = await fetch(NODE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: 1,
                jsonrpc: '2.0',
                method: 'state_get_dictionary_item',
                params: {
                    state_root_hash: stateRoot,
                    dictionary_identifier: {
                        URef: {
                            seed_uref: STATE_UREF,
                            dictionary_item_key: dictKey
                        }
                    }
                }
            })
        }).then(r => r.json());

        if (res.result && res.result.stored_value) {
            console.log(`FOUND at Index ${i}:`, JSON.stringify(res.result.stored_value.CLValue.parsed));
        } else {
            console.log(`Index ${i}: Not found`);
            // console.log(JSON.stringify(res));
        }

        // Also try WITHOUT Tag 0 (some Odra variants)
        const combinedNoTag = new Uint8Array(indexBytes.length + mappingKey.length);
        combinedNoTag.set(indexBytes);
        combinedNoTag.set(mappingKey, indexBytes.length);
        const dictKeyNoTag = blake2bHex(combinedNoTag, undefined, 32);

        const res2 = await fetch(NODE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: 1,
                jsonrpc: '2.0',
                method: 'state_get_dictionary_item',
                params: {
                    state_root_hash: stateRoot,
                    dictionary_identifier: {
                        URef: {
                            seed_uref: STATE_UREF,
                            dictionary_item_key: dictKeyNoTag
                        }
                    }
                }
            })
        }).then(r => r.json());

        if (res2.result && res2.result.stored_value) {
            console.log(`FOUND at Index ${i} (No Tag):`, JSON.stringify(res2.result.stored_value.CLValue.parsed));
            console.log(`SUCCESSFUL BITKEY (No Tag): ${dictKeyNoTag}`);
        }
    }
}

main();
