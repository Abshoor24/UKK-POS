const { detectImageType } = require('../src/services/imageValidator');

describe('detectImageType', () => {
  test('mengenali JPEG', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(detectImageType(buffer)).toBe('image/jpeg');
  });

  test('mengenali PNG', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(detectImageType(buffer)).toBe('image/png');
  });

  test('mengenali GIF', () => {
    expect(detectImageType(Buffer.from('GIF89a000000'))).toBe('image/gif');
  });

  test('mengenali WebP', () => {
    expect(detectImageType(Buffer.from('RIFF0000WEBP'))).toBe('image/webp');
  });

  test('file teks biasa ditolak walau namanya foto.jpg', () => {
    expect(detectImageType(Buffer.from('ini bukan gambar, hanya teks biasa'))).toBeNull();
  });

  test('buffer terlalu pendek atau bukan buffer ditolak', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
    expect(detectImageType('teks')).toBeNull();
    expect(detectImageType(undefined)).toBeNull();
  });
});