import * as crypto from 'crypto';

function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  const length = Math.floor(clean.length * 5 / 8);
  const buffer = Buffer.alloc(length);

  let bits = 0;
  let value = 0;
  let index = 0;

  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) {
      throw new Error(`Invalid base32 character: ${clean[i]}`);
    }

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      buffer[index++] = (value >> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }
  return buffer;
}

export function generateTOTP(secret: string): string {
  const key = base32Decode(secret);
  const epoch = Math.round(new Date().getTime() / 1000.0);
  const time = Buffer.alloc(8);
  const steps = Math.floor(epoch / 30);
  
  // Write steps as 64-bit integer
  time.writeUInt32BE(Math.floor(steps / 0x100000000), 0);
  time.writeUInt32BE(steps & 0xffffffff, 4);

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(time);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const code = ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  return String(code % 1000000).padStart(6, '0');
}
export default generateTOTP;
