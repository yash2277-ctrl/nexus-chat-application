// End-to-end encryption utilities using Web Crypto API

class E2EEncryption {
  constructor() {
    this.keyPair = null;
    this.sharedKeys = new Map(); // userId -> CryptoKey
  }

  // Generate RSA key pair for the user
  async generateKeyPair() {
    this.keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['encrypt', 'decrypt']
    );

    return this.keyPair;
  }

  // Export public key as base64 string
  async exportPublicKey() {
    if (!this.keyPair) await this.generateKeyPair();
    const exported = await window.crypto.subtle.exportKey('spki', this.keyPair.publicKey);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  }

  // Import a public key from base64 string
  async importPublicKey(base64Key) {
    const binaryStr = atob(base64Key);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    return window.crypto.subtle.importKey(
      'spki',
      bytes.buffer,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      true,
      ['encrypt']
    );
  }

  // Generate AES key for symmetric encryption
  async generateAESKey() {
    return window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt message with AES-GCM
  async encryptMessage(message, aesKey) {
    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encoder.encode(message)
    );

    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  // Decrypt message with AES-GCM
  async decryptMessage(encryptedBase64, aesKey) {
    try {
      const binaryStr = atob(encryptedBase64);
      const combined = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        combined[i] = binaryStr.charCodeAt(i);
      }

      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        encrypted
      );

      return new TextDecoder().decode(decrypted);
    } catch (err) {
      console.error('Decryption failed:', err);
      return '[Encrypted message]';
    }
  }

  // Encrypt AES key with RSA public key (for key exchange)
  async encryptAESKey(aesKey, publicKey) {
    const exported = await window.crypto.subtle.exportKey('raw', aesKey);
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      exported
    );
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  }

  // Decrypt AES key with RSA private key
  async decryptAESKey(encryptedKeyBase64) {
    if (!this.keyPair) return null;

    const binaryStr = atob(encryptedKeyBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      this.keyPair.privateKey,
      bytes.buffer
    );

    return window.crypto.subtle.importKey(
      'raw',
      decrypted,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Simple encrypt/decrypt for local storage
  async simpleEncrypt(text) {
    const key = await this.getLocalKey();
    return this.encryptMessage(text, key);
  }

  async simpleDecrypt(encrypted) {
    const key = await this.getLocalKey();
    return this.decryptMessage(encrypted, key);
  }

  async getLocalKey() {
    const stored = localStorage.getItem('nexus_local_key');
    if (stored) {
      const keyData = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
      return window.crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    }

    const key = await this.generateAESKey();
    const exported = await window.crypto.subtle.exportKey('raw', key);
    localStorage.setItem('nexus_local_key', btoa(String.fromCharCode(...new Uint8Array(exported))));
    return key;
  }
}

export const encryption = new E2EEncryption();
export default encryption;
