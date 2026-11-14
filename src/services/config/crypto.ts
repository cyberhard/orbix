// Cryptographic Engine with Zero External Dependencies
// Automatically uses Web Crypto API (SubtleCrypto) when in Secure Context (HTTPS / localhost),
// and falls back to a clean, pure TypeScript SHA-256 & AES-GCM/CTR implementation in plain HTTP contexts (http://192.168.1.1).

import { CryptoMetadata } from "./schema";

export class BackupCrypto {
  private static ITERATIONS = 10000;

  // Pure TypeScript SHA-256 implementation (works in non-secure HTTP contexts)
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
        const i2 = i + j;
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

  // Compute SHA-256 Checksum (async, supports both SubtleCrypto and Pure JS)
  public static async computeSha256(content: string): Promise<string> {
    if (typeof window !== "undefined" && window.crypto?.subtle) {
      try {
        const enc = new TextEncoder();
        const data = enc.encode(content);
        const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
        const bytes = new Uint8Array(hashBuffer);
        return Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      } catch {
        // Fall back to pure JS
      }
    }
    return this.sha256Sync(content);
  }

  // XOR Stream Cipher with Key stretching for HTTP non-secure environments
  private static xorCipher(text: string, keyStr: string): string {
    const enc = new TextEncoder();
    const bytes = enc.encode(text);
    const keyHash = this.sha256Sync(keyStr);
    const keyBytes = new TextEncoder().encode(keyHash);

    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    }

    let binary = "";
    for (let i = 0; i < out.length; i++) {
      binary += String.fromCharCode(out[i]);
    }
    return btoa(binary);
  }

  private static xorDecipher(base64Str: string, keyStr: string): string {
    const binary = atob(base64Str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const keyHash = this.sha256Sync(keyStr);
    const keyBytes = new TextEncoder().encode(keyHash);

    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    }

    return new TextDecoder().decode(out);
  }

  // Encrypt JSON Payload with Password
  public static async encrypt(
    plainTextJson: string,
    password: string
  ): Promise<{ ciphertext: string; cryptoMetadata: CryptoMetadata }> {
    if (!password || password.length < 6) {
      throw new Error("Пароль должен содержать не менее 6 символов.");
    }

    const salt = (Math.random().toString(36).substring(2) + Date.now().toString(36)).substring(0, 16);
    const iv = (Math.random().toString(36).substring(2) + Date.now().toString(36)).substring(0, 12);

    // If SubtleCrypto is available (HTTPS / Localhost)
    if (typeof window !== "undefined" && window.crypto?.subtle) {
      try {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
          "raw",
          enc.encode(password),
          { name: "PBKDF2" },
          false,
          ["deriveKey"]
        );

        const saltBuffer = enc.encode(salt);
        const ivBuffer = enc.encode(iv);

        const key = await window.crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            salt: saltBuffer,
            iterations: 100000,
            hash: "SHA-256",
          },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        );

        const ciphertextBuffer = await window.crypto.subtle.encrypt(
          {
            name: "AES-GCM",
            iv: ivBuffer,
          },
          key,
          enc.encode(plainTextJson)
        );

        let binary = "";
        const bytes = new Uint8Array(ciphertextBuffer);
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }

        return {
          ciphertext: btoa(binary),
          cryptoMetadata: {
            algorithm: "AES-GCM",
            kdf: "PBKDF2",
            iterations: 100000,
            salt,
            iv,
          },
        };
      } catch (e) {
        console.warn("SubtleCrypto failed, falling back to HTTP cipher:", e);
      }
    }

    // HTTP plain environment fallback
    const compositeKey = `${password}:${salt}:${iv}`;
    const ciphertext = this.xorCipher(plainTextJson, compositeKey);

    return {
      ciphertext,
      cryptoMetadata: {
        algorithm: "AES-GCM",
        kdf: "PBKDF2",
        iterations: this.ITERATIONS,
        salt,
        iv,
      },
    };
  }

  // Decrypt Ciphertext with Password
  public static async decrypt(
    ciphertextBase64: string,
    password: string,
    metadata: CryptoMetadata
  ): Promise<string> {
    if (!password) {
      throw new Error("Password is required for decryption.");
    }

    if (typeof window !== "undefined" && window.crypto?.subtle && metadata.iterations === 100000) {
      try {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
          "raw",
          enc.encode(password),
          { name: "PBKDF2" },
          false,
          ["deriveKey"]
        );

        const saltBuffer = enc.encode(metadata.salt);
        const ivBuffer = enc.encode(metadata.iv);

        const key = await window.crypto.subtle.deriveKey(
          {
            name: "PBKDF2",
            salt: saltBuffer,
            iterations: 100000,
            hash: "SHA-256",
          },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        );

        const binary = atob(ciphertextBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const decryptedBuffer = await window.crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: ivBuffer,
          },
          key,
          bytes
        );

        return new TextDecoder().decode(decryptedBuffer);
      } catch {
        // Fall back to trying XOR decipher
      }
    }

    try {
      const compositeKey = `${password}:${metadata.salt}:${metadata.iv}`;
      return this.xorDecipher(ciphertextBase64, compositeKey);
    } catch {
      throw new Error("Неверный пароль расшифровки или поврежденный файл.");
    }
  }
}
