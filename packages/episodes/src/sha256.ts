const ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

function utf8(value: string): Uint8Array {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    let codePoint = value.charCodeAt(index);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + next - 0xdc00;
        index += 1;
      } else {
        codePoint = 0xfffd;
      }
    } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
      codePoint = 0xfffd;
    }
    if (codePoint <= 0x7f) bytes.push(codePoint);
    else if (codePoint <= 0x7ff) bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
    else if (codePoint <= 0xffff) bytes.push(0xe0 | (codePoint >>> 12), 0x80 | ((codePoint >>> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    else bytes.push(0xf0 | (codePoint >>> 18), 0x80 | ((codePoint >>> 12) & 0x3f), 0x80 | ((codePoint >>> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
  }
  return Uint8Array.from(bytes);
}

function add(...values: number[]): number {
  let result = 0;
  for (const value of values) result = (result + value) >>> 0;
  return result;
}

/** Portable synchronous SHA-256 for the small immutable episode artifacts. */
export function sha256Hex(value: string): string {
  const input = utf8(value);
  const bitLengthHigh = Math.floor(input.length / 0x20000000);
  const bitLengthLow = (input.length % 0x20000000) * 8;
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const message = new Uint8Array(paddedLength);
  message.set(input);
  message[input.length] = 0x80;
  const lengthOffset = paddedLength - 8;
  message[lengthOffset] = (bitLengthHigh >>> 24) & 0xff;
  message[lengthOffset + 1] = (bitLengthHigh >>> 16) & 0xff;
  message[lengthOffset + 2] = (bitLengthHigh >>> 8) & 0xff;
  message[lengthOffset + 3] = bitLengthHigh & 0xff;
  message[lengthOffset + 4] = (bitLengthLow >>> 24) & 0xff;
  message[lengthOffset + 5] = (bitLengthLow >>> 16) & 0xff;
  message[lengthOffset + 6] = (bitLengthLow >>> 8) & 0xff;
  message[lengthOffset + 7] = bitLengthLow & 0xff;

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const schedule = new Uint32Array(64);
  for (let offset = 0; offset < message.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const base = offset + index * 4;
      schedule[index] = ((message[base] << 24) | (message[base + 1] << 16) | (message[base + 2] << 8) | message[base + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const value = schedule[index - 15];
      const sigma0 = rotr(value, 7) ^ rotr(value, 18) ^ (value >>> 3);
      const previous = schedule[index - 2];
      const sigma1 = rotr(previous, 17) ^ rotr(previous, 19) ^ (previous >>> 10);
      schedule[index] = add(schedule[index - 16], sigma0, schedule[index - 7], sigma1);
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temporary1 = add(h, sum1, choose, ROUND_CONSTANTS[index], schedule[index]);
      const sum0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = add(sum0, majority);
      h = g;
      g = f;
      f = e;
      e = add(d, temporary1);
      d = c;
      c = b;
      b = a;
      a = add(temporary1, temporary2);
    }
    hash[0] = add(hash[0], a);
    hash[1] = add(hash[1], b);
    hash[2] = add(hash[2], c);
    hash[3] = add(hash[3], d);
    hash[4] = add(hash[4], e);
    hash[5] = add(hash[5], f);
    hash[6] = add(hash[6], g);
    hash[7] = add(hash[7], h);
  }
  return Array.from(hash, (value) => value.toString(16).padStart(8, '0')).join('');
}
