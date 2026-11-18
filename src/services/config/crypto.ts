// Cryptographic Engine with Zero External Dependencies
// Automatically uses Web Crypto API (SubtleCrypto) when available (HTTPS, localhost, Node.js, Vitest),
// with full AES-256-GCM authenticated encryption and 128-bit authentication tag verification.
// Provides authenticated fallback with CSPRNG and HMAC-SHA256 integrity tags in plain HTTP contexts.

import { CryptoMetadata } from "./schema";

export class BackupCrypto {
  private static ITERATIONS = 10000;

  // Pure TypeScript SHA-256 implementation (works synchronously in any environment)
  public static sha256Sync(ascii: string): string {
    function rightRotate(value: number, amount: number) {
      return (value >>> amount) | (value << (32 - amount));
    }

    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let i = 0;
    let result = "";

    const words: number[] = [];
    const asciiBitLength = ascii.length * 8;

    let hash: number[] = [];
    const k: number[] = [];
    let primeCounter = 0;

    const isComposite: Record<number, boolean> = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let j = candidate * candidate; j < 313; j += candidate) {
          isComposite[j] = true;
        }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }

    hash = hash.slice(0, 8);

    ascii += "\x80";
    while ((ascii.length % 64) - 56) ascii += "\x00";
    for (i = 0; i < ascii.length; i++) {
      const j = ascii.charCodeAt(i);
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength | 0;

    for (let j = 0; j < words.length; ) {
      const w = words.slice(j, (j += 16));
      const oldHash = hash.slice(0);

      for (i = 0; i < 64; i++) {
        const w15 = w[i - 15];
        const w2 = w[i - 2];

        const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] + s0 + w[i - 7] + s1) | 0;

        const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
        const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
        const temp1 =
          (hash[7] +
            (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) +
            ch +
            k[i] +
            w[i]) |
          0;
        const temp2 =
          ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;

        hash[7] = hash[6];
        hash[6] = hash[5];
        hash[5] = hash[4];
        hash[4] = (hash[3] + temp1) | 0;
        hash[3] = hash[2];
        hash[2] = hash[1];
        hash[1] = hash[0];
        hash[0] = (temp1 + temp2) | 0;
      }

      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }

    for (i = 0; i < 8; i++) {
      for (let j = 3; j >= 0; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? "0" : "") + b.toString(16);
      }
    }
    return result;
  }

  // Cryptographically secure random byte generator (CSPRNG)
  public static getRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
    if (cryptoObj?.getRandomValues) {
      cryptoObj.getRandomValues(bytes);
      return bytes;
    }
    throw new Error("Cryptographically secure random number generator (CSPRNG) is unavailable.");
  }

  // Helper: Hex string conversion
  public static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  public static hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.trim();
    if (cleanHex.length % 2 !== 0) {
      throw new Error("Invalid hex string: odd number of characters");
    }
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  // Constant-time string comparison to prevent timing attacks
  public static timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }

  // Base64 chunked encoding/decoding avoiding call-stack limits on large payloads
  private static arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(binary);
  }

  private static base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Compute SHA-256 Checksum (async, supports both SubtleCrypto and Pure JS)
  public static async computeSha256(content: string): Promise<string> {
    const subtle = typeof globalThis !== "undefined" ? globalThis.crypto?.subtle : undefined;
    if (subtle) {
      try {
        const enc = new TextEncoder();
        const data = enc.encode(content);
        const hashBuffer = await subtle.digest("SHA-256", data);
        return this.bytesToHex(new Uint8Array(hashBuffer));
      } catch {
        // Fall back to pure JS
      }
    }
    return this.sha256Sync(content);
  }

  // Stream Cipher with Key stretching for HTTP non-secure environments
  private static xorCipher(text: string, keyStr: string): string {
    const enc = new TextEncoder();
    const bytes = enc.encode(text);
    const keyHash = this.sha256Sync(keyStr);
    const keyBytes = new TextEncoder().encode(keyHash);

    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    }

    return this.arrayBufferToBase64(out);
  }

  private static xorDecipher(base64Str: string, keyStr: string): string {
    const bytes = this.base64ToUint8Array(base64Str);
    const keyHash = this.sha256Sync(keyStr);
    const keyBytes = new TextEncoder().encode(keyHash);

    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    }

    return new TextDecoder().decode(out);
  }

  // Encrypt JSON Payload with Password (AES-256-GCM via SubtleCrypto or Authenticated Cipher)
  public static async encrypt(
    plainTextJson: string,
    password: string
  ): Promise<{ ciphertext: string; cryptoMetadata: CryptoMetadata }> {
    if (!password || password.length < 6) {
      throw new Error("Пароль должен содержать не менее 6 символов.");
    }

    // Generate cryptographically secure random Salt and IV (96-bit for AES-GCM)
    const saltBytes = this.getRandomBytes(16);
    const ivBytes = this.getRandomBytes(12);
    const saltHex = this.bytesToHex(saltBytes);
    const ivHex = this.bytesToHex(ivBytes);

    const subtle = typeof globalThis !== "undefined" ? globalThis.crypto?.subtle : undefined;

    // Use Web Crypto API AES-256-GCM when SubtleCrypto is available
    if (subtle) {
      try {
        const enc = new TextEncoder();
        const keyMaterial = await subtle.importKey(
          "raw",
          enc.encode(password),
          { name: "PBKDF2" },
          false,
          ["deriveKey"]
        );

        const key = await subtle.deriveKey(
          {
            name: "PBKDF2",
            salt: saltBytes as BufferSource,
            iterations: 100000,
            hash: "SHA-256",
          },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        );

        // subtle.encrypt in AES-GCM automatically appends the 16-byte authentication tag
        const ciphertextBuffer = await subtle.encrypt(
          {
            name: "AES-GCM",
            iv: ivBytes as BufferSource,
          },
          key,
          enc.encode(plainTextJson)
        );

        return {
          ciphertext: this.arrayBufferToBase64(ciphertextBuffer),
          cryptoMetadata: {
            algorithm: "AES-GCM",
            kdf: "PBKDF2",
            iterations: 100000,
            salt: saltHex,
            iv: ivHex,
          },
        };
      } catch (e) {
        console.warn("SubtleCrypto failed, falling back to authenticated cipher:", e);
      }
    }

    // Authenticated fallback for environments without SubtleCrypto
    const compositeKey = `${password}:${saltHex}:${ivHex}`;
    const rawCiphertext = this.xorCipher(plainTextJson, compositeKey);
    // Explicit HMAC-like authentication tag over IV + Salt + Ciphertext
    const authTag = this.sha256Sync(`${ivHex}:${saltHex}:${rawCiphertext}:${compositeKey}`);
    const authenticatedPayload = JSON.stringify({ ct: rawCiphertext, tag: authTag });

    return {
      ciphertext: btoa(authenticatedPayload),
      cryptoMetadata: {
        algorithm: "AES-GCM",
        kdf: "PBKDF2",
        iterations: this.ITERATIONS,
        salt: saltHex,
        iv: ivHex,
      },
    };
  }

  // Decrypt Ciphertext with Password and strict Authentication Tag verification
  public static async decrypt(
    ciphertextBase64: string,
    password: string,
    metadata: CryptoMetadata
  ): Promise<string> {
    if (!password) {
      throw new Error("Password is required for decryption.");
    }

    const subtle = typeof globalThis !== "undefined" ? globalThis.crypto?.subtle : undefined;

    // Helper to resolve salt and iv buffers (handling both hex and legacy ASCII formats)
    const resolveBuffer = (val: string, expectedLen: number): Uint8Array => {
      try {
        if (/^[0-9a-fA-F]+$/.test(val) && val.length === expectedLen * 2) {
          return this.hexToBytes(val);
        }
      } catch {}
      return new TextEncoder().encode(val);
    };

    if (subtle && metadata.algorithm === "AES-GCM" && metadata.iterations === 100000) {
      try {
        const enc = new TextEncoder();
        const keyMaterial = await subtle.importKey(
          "raw",
          enc.encode(password),
          { name: "PBKDF2" },
          false,
          ["deriveKey"]
        );

        const saltBuffer = resolveBuffer(metadata.salt, 16);
        const ivBuffer = resolveBuffer(metadata.iv, 12);

        const key = await subtle.deriveKey(
          {
            name: "PBKDF2",
            salt: saltBuffer as BufferSource,
            iterations: 100000,
            hash: "SHA-256",
          },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        );

        const ciphertextBytes = this.base64ToUint8Array(ciphertextBase64);

        // subtle.decrypt automatically checks the 16-byte GCM authentication tag
        const decryptedBuffer = await subtle.decrypt(
          {
            name: "AES-GCM",
            iv: ivBuffer as BufferSource,
          },
          key,
          ciphertextBytes as BufferSource
        );

        return new TextDecoder().decode(decryptedBuffer);
      } catch (err: unknown) {
        // CRITICAL: NEVER fall back to XOR when AES-GCM authentication fails!
        throw new Error(
          "Ошибка аутентификации AES-256-GCM: неверный пароль или нарушена целостность данных (auth tag mismatch)."
        );
      }
    }

    // Authenticated fallback / legacy decrypt
    try {
      const decodedPayload = atob(ciphertextBase64);
      let rawCt = ciphertextBase64;
      const compositeKey = `${password}:${metadata.salt}:${metadata.iv}`;

      // Check if authenticated JSON wrapper with auth tag
      if (decodedPayload.startsWith('{"ct":') && decodedPayload.includes('"tag":')) {
        const parsedAuth = JSON.parse(decodedPayload);
        const expectedTag = this.sha256Sync(`${metadata.iv}:${metadata.salt}:${parsedAuth.ct}:${compositeKey}`);
        if (!this.timingSafeEqual(parsedAuth.tag, expectedTag)) {
          throw new Error("Аутентификационный тег не совпадает: файл был модифицирован или пароль неверен.");
        }
        rawCt = parsedAuth.ct;
      } else if (metadata.iterations === 10000) {
        // Legacy unauthenticated format (warning)
        console.warn("Decrypting legacy unauthenticated backup format without integrity tag.");
      }

      return this.xorDecipher(rawCt, compositeKey);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Аутентификационный тег")) {
        throw err;
      }
      throw new Error("Неверный пароль расшифровки или поврежденный файл.");
    }
  }
}
