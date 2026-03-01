import { createHmac, randomBytes } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string) {
  const normalized = input
    .toUpperCase()
    .replace(/=+$/, '')
    .replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0xf;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binary % 1_000_000).toString().padStart(6, '0');
}

function currentCounter(periodSeconds = 30, now = Date.now()) {
  return Math.floor(now / 1000 / periodSeconds);
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function verifyTotpCode(
  secretBase32: string,
  code: string,
  window = 1,
  periodSeconds = 30,
) {
  const sanitizedCode = String(code || '')
    .trim()
    .replace(/\s+/g, '');
  if (!/^\d{6}$/.test(sanitizedCode)) return false;

  const secret = base32Decode(secretBase32);
  const counter = currentCounter(periodSeconds);
  for (let offset = -window; offset <= window; offset += 1) {
    if (hotp(secret, counter + offset) === sanitizedCode) return true;
  }
  return false;
}

export function buildOtpAuthUri(
  accountEmail: string,
  secretBase32: string,
  issuer = 'LexFlow',
) {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const issuerParam = encodeURIComponent(issuer);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${issuerParam}&algorithm=SHA1&digits=6&period=30`;
}
