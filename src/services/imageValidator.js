/**
 * Mendeteksi jenis file gambar berdasarkan byte awal file
 * Hanya JPEG, PNG, GIF dan WEbp yang didukung
 * @param {Buffer} buffer - isi file
 * @returns {string|null} - 'image/jpeg', 'image/png', 'image/gif', 'image/webp' atau null jika tidak valid
 * 
 */


function detectImageType(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null; 
    
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
    }
    if (buffer.subarray(0, 8).equals(pngSignature)) {
        return 'image/png';
    }
    if (buffer.toString('ascii', 0, 4) === 'GIF8') {
        return 'image/gif';
    }
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
        return 'image/webp';
    }
    return null;
}

module.exports = { detectImageType };