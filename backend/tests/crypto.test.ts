import { encryptText, decryptText } from '../src/utils/crypto';

describe('AES-256-GCM Encryption / Decryption', () => {
  it('should encrypt plaintext into IV:ciphertext:tag format and decrypt back cleanly', () => {
    const secretMessage = 'xoxb-slack-bot-token-secret-12345';
    const encrypted = encryptText(secretMessage);

    expect(encrypted).not.toBe(secretMessage);
    expect(encrypted.split(':')).toHaveLength(3);

    const decrypted = decryptText(encrypted);
    expect(decrypted).toBe(secretMessage);
  });

  it('should fail or throw on tampered ciphertext', () => {
    const secretMessage = 'confidential-smtp-pass';
    const encrypted = encryptText(secretMessage);
    const parts = encrypted.split(':');
    parts[1] = 'tampered' + parts[1].substring(8);
    const tampered = parts.join(':');

    expect(() => decryptText(tampered)).toThrow();
  });
});
