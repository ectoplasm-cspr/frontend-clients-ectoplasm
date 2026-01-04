const { blake2bHex } = require('blakejs');

// Test both u8 and u32 index encoding for Odra Var keys

function generateKeyU8(index) {
    // Single byte index (u8)
    const indexByte = new Uint8Array([index]);
    return blake2bHex(indexByte, undefined, 32);
}

function generateKeyU32BigEndian(index) {
    // 4 bytes Big Endian (current implementation)
    const indexBytes = new Uint8Array(4);
    new DataView(indexBytes.buffer).setUint32(0, index, false);
    return blake2bHex(indexBytes, undefined, 32);
}

function generateKeyU32LittleEndian(index) {
    // 4 bytes Little Endian
    const indexBytes = new Uint8Array(4);
    new DataView(indexBytes.buffer).setUint32(0, index, true);
    return blake2bHex(indexBytes, undefined, 32);
}

console.log("Testing index 3 (should be reserve0 or token0):");
console.log("u8:              ", generateKeyU8(3));
console.log("u32 Big Endian:  ", generateKeyU32BigEndian(3));
console.log("u32 Little End:  ", generateKeyU32LittleEndian(3));

console.log("\nTesting index 4 (should be reserve1):");
console.log("u8:              ", generateKeyU8(4));
console.log("u32 Big Endian:  ", generateKeyU32BigEndian(4));
console.log("u32 Little End:  ", generateKeyU32LittleEndian(4));

console.log("\nTesting index 5:");
console.log("u8:              ", generateKeyU8(5));
console.log("u32 Big Endian:  ", generateKeyU32BigEndian(5));
console.log("u32 Little End:  ", generateKeyU32LittleEndian(5));

// The keys we're currently generating (u32 BE):
console.log("\n=== Current Implementation (u32 BE) ===");
console.log("Index 3 key:", generateKeyU32BigEndian(3));
console.log("Index 4 key:", generateKeyU32BigEndian(4));
console.log("Index 5 key:", generateKeyU32BigEndian(5));
