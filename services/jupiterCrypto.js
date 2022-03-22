const logger = require('../utils/logger')(module)
const crypto = require('crypto')
import { sharedKey } from 'curve25519-js'
// npm i curve25519-js
const gzip = require('gzip-js')

class JupiterCrypto {
  /**
   *
   * @param publicKey
   * @param encryptedData
   * @param recipientSecretPhrase
   * @param uncompress
   * @returns {*}
   */
  decryptFrom(publicKey, encryptedData, recipientSecretPhrase, uncompress) {
    let decrypted = this.decrypt(encryptedData, recipientSecretPhrase, publicKey)
    if (uncompress && decrypted.length > 0) {
      decrypted = Convert.uncompress(decrypted)
    }
    return decrypted
  }

  /**
   *
   * @param secretPhrase
   * @param theirPublicKey
   * @returns {*}
   */
  decrypt(data, secretPhrase, theirPublicKey) {
    if (data.length == 0) {
      return data
    }
    const sharedKey = this.getSharedKey(this.getPrivateKey(secretPhrase), theirPublicKey, nonce)

    const decipher = crypto.createDecipher('aes-256-cbc', sharedKey)
    let dec = decipher.update(data, 'hex', 'utf8')
    dec += decipher.final('utf8')

    return dec
  }

  /**
   *
   * @param myPrivateKey
   * @param theirPublicKey
   * @returns {*}
   */
  getSharedSecret(myPrivateKey, theirPublicKey) {
    // const buffer = new ArrayBuffer(8);
    // const sharedSecret = new ArrayBuffer[32];
    const sharedSecret = sharedKey(myPrivateKey, theirPublicKey)

    // const alicePriv = Uint8Array.from(Buffer.from(ALICE_PRIV, 'hex'));
    // const bobPub = Uint8Array.from(Buffer.from(BOB_PUB, 'hex'));
    // const secret = sharedKey(alicePriv, bobPub);

    // Curve25519.curve(sharedSecret, myPrivateKey, theirPublicKey);

    return sharedSecret
  }

  /**
   *
   * @param myPrivateKey
   * @param theirPublicKey
   * @param nonce
   * @returns {string}
   */
  getSharedKey(myPrivateKey, theirPublicKey, nonce) {
    const sharedSecret = this.getSharedSecret(myPrivateKey, theirPublicKey)
    const dhSharedSecret = crypto.createHash('sha256').update(this.toUTF8Array(sharedSecret)).digest('hex')
    for (let i = 0; i < 32; i++) {
      dhSharedSecret[i] ^= nonce[i]
    }

    const out = crypto.createHash('sha256').update(this.toUTF8Array(dhSharedSecret)).digest('hex')

    return out
  }

  /**
   *
   * @param secretPhrase
   * @returns {*}
   */
  getPrivateKey(secretPhrase) {
    const hash = crypto.createHash('sha256').update(this.toUTF8Array(secretPhrase)).digest('hex')
    // byte[] s = Crypto.sha256().digest(this.toUTF8Array(secretPhrase));
    const s = this.clamp(hash)

    return s
  }

  /**
   *
   * @param utf8Array
   * @returns {*}
   */
  clamp(utf8Array) {
    utf8Array[31] &= 0x7f
    utf8Array[31] |= 0x40
    utf8Array[0] &= 0xf8

    return utf8Array
  }

  /**
   *
   * @param str
   * @returns {*[]}
   */
  toUTF8Array(str) {
    var utf8 = []
    for (var i = 0; i < str.length; i++) {
      var charcode = str.charCodeAt(i)
      if (charcode < 0x80) utf8.push(charcode)
      else if (charcode < 0x800) {
        utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f))
      } else if (charcode < 0xd800 || charcode >= 0xe000) {
        utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f))
      }
      // surrogate pair
      else {
        i++
        // UTF-16 encodes 0x10000-0x10FFFF by
        // subtracting 0x10000 and splitting the
        // 20 bits of 0x0-0xFFFFF into two halves
        charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff))
        utf8.push(
          0xf0 | (charcode >> 18),
          0x80 | ((charcode >> 12) & 0x3f),
          0x80 | ((charcode >> 6) & 0x3f),
          0x80 | (charcode & 0x3f)
        )
      }
    }
    return utf8
  }
}

module.exports.JupiterCrypto = JupiterCrypto

/*
 * Copyright © 2013-2016 The Nxt Core Developers.
 * Copyright © 2016-2017 Jelurida IP B.V.
 *
 * See the LICENSE.txt file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with Jelurida B.V.,
 * no part of the Nxt software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE.txt file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 */

// package nxt.crypto;
//
// import nxt.NxtException;
// import nxt.util.Convert;
//
// import java.nio.ByteBuffer;
// import java.nio.ByteOrder;
//
// public final class EncryptedData {
//
//     public static final EncryptedData EMPTY_DATA = new EncryptedData(new byte[0], new byte[0]);
//
//     public static EncryptedData encrypt(byte[] plaintext, String secretPhrase, byte[] theirPublicKey) {
//     if (plaintext.length == 0) {
//     return EMPTY_DATA;
// }
// byte[] nonce = new byte[32];
// Crypto.getSecureRandom().nextBytes(nonce);
// byte[] sharedKey = Crypto.getSharedKey(Crypto.getPrivateKey(secretPhrase), theirPublicKey, nonce);
// byte[] data = Crypto.aesEncrypt(plaintext, sharedKey);
// return new EncryptedData(data, nonce);
// }
//
// public static EncryptedData readEncryptedData(ByteBuffer buffer, int length, int maxLength)
// throws NxtException.NotValidException {
//     if (length == 0) {
//         return EMPTY_DATA;
//     }
// //        if (length > maxLength) {
// //           throw new NxtException.NotValidException("Max encrypted data length exceeded: " + length);
// //        }
//     byte[] data = new byte[length];
//     buffer.get(data);
//     byte[] nonce = new byte[32];
//     buffer.get(nonce);
//     return new EncryptedData(data, nonce);
// }
//
// public static EncryptedData readEncryptedData(byte[] bytes) {
//     if (bytes.length == 0) {
//         return EMPTY_DATA;
//     }
//     ByteBuffer buffer = ByteBuffer.wrap(bytes);
//     buffer.order(ByteOrder.LITTLE_ENDIAN);
//     try {
//         return readEncryptedData(buffer, bytes.length - 32, Integer.MAX_VALUE);
//     } catch (NxtException.NotValidException e) {
//         throw new RuntimeException(e.toString(), e); // never
//     }
// }
//
// public static int getEncryptedDataLength(byte[] plaintext) {
//     if (plaintext.length == 0) {
//         return 0;
//     }
//     return Crypto.aesEncrypt(plaintext, new byte[32]).length;
// }
//
// public static int getEncryptedSize(byte[] plaintext) {
//     if (plaintext.length == 0) {
//         return 0;
//     }
//     return getEncryptedDataLength(plaintext) + 32;
// }
//
// private final byte[] data;
// private final byte[] nonce;
//
// public EncryptedData(byte[] data, byte[] nonce) {
//     this.data = data;
//     this.nonce = nonce;
// }
//
// public byte[] decrypt(String secretPhrase, byte[] theirPublicKey) {
//     if (data.length == 0) {
//         return data;
//     }
//     byte[] sharedKey = Crypto.getSharedKey(Crypto.getPrivateKey(secretPhrase), theirPublicKey, nonce);
//     return Crypto.aesDecrypt(data, sharedKey);
// }
//
// public byte[] getData() {
//     return data;
// }
//
// public byte[] getNonce() {
//     return nonce;
// }
//
// public int getSize() {
//     return data.length + nonce.length;
// }
//
// public byte[] getBytes() {
//     ByteBuffer buffer = ByteBuffer.allocate(nonce.length + data.length);
//     buffer.order(ByteOrder.LITTLE_ENDIAN);
//     buffer.put(data);
//     buffer.put(nonce);
//     return buffer.array();
// }
//
// @Override
// public String toString() {
//     return "data: " + Convert.toHexString(data) + " nonce: " + Convert.toHexString(nonce);
// }
//
// }

/*
 * Copyright © 2013-2016 The Nxt Core Developers.
 * Copyright © 2016-2017 Jelurida IP B.V.
 *
 * See the LICENSE.txt file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with Jelurida B.V.,
 * no part of the Nxt software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE.txt file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 */

// package nxt.crypto;
//
// import nxt.Nxt;
// import nxt.util.Convert;
// import nxt.util.Logger;
// import org.bouncycastle.crypto.CipherParameters;
// import org.bouncycastle.crypto.InvalidCipherTextException;
// import org.bouncycastle.crypto.engines.AESEngine;
// import org.bouncycastle.crypto.modes.CBCBlockCipher;
// import org.bouncycastle.crypto.modes.GCMBlockCipher;
// import org.bouncycastle.crypto.paddings.PaddedBufferedBlockCipher;
// import org.bouncycastle.crypto.params.KeyParameter;
// import org.bouncycastle.crypto.params.ParametersWithIV;
// import org.bouncycastle.jcajce.provider.digest.Keccak;
// import org.bouncycastle.jcajce.provider.digest.RIPEMD160;
//
// import java.security.MessageDigest;
// import java.security.NoSuchAlgorithmException;
// import java.security.SecureRandom;
// import java.util.Arrays;
//
// public final class Crypto {
//
//     private static final boolean useStrongSecureRandom = Nxt.getBooleanProperty("nxt.useStrongSecureRandom");
//
//     private static final ThreadLocal<SecureRandom> secureRandom = new ThreadLocal<SecureRandom>() {
//     @Override
//     protected SecureRandom initialValue() {
//         try {
//             SecureRandom secureRandom = useStrongSecureRandom ? SecureRandom.getInstanceStrong() : new SecureRandom();
//             secureRandom.nextBoolean();
//             return secureRandom;
//         } catch (NoSuchAlgorithmException e) {
//             Logger.logErrorMessage("No secure random provider available");
//             throw new RuntimeException(e.getMessage(), e);
//         }
//     }
// };
//
// private Crypto() {} //never
//
// public static SecureRandom getSecureRandom() {
//     return secureRandom.get();
// }
//
// public static MessageDigest getMessageDigest(String algorithm) {
//     try {
//         return MessageDigest.getInstance(algorithm);
//     } catch (NoSuchAlgorithmException e) {
//         Logger.logMessage("Missing message digest algorithm: " + algorithm);
//         throw new RuntimeException(e.getMessage(), e);
//     }
// }
//
// public static MessageDigest sha256() {
//     return getMessageDigest("SHA-256");
// }
//
// public static MessageDigest ripemd160() {
//     return new RIPEMD160.Digest();
// }
//
// public static MessageDigest sha3() {
//     return new Keccak.Digest256();
// }
//
// public static byte[] getKeySeed(String secretPhrase, byte[]... nonces) {
//     MessageDigest digest = Crypto.sha256();
//     digest.update(Convert.toBytes(secretPhrase));
//     for (byte[] nonce : nonces) {
//         digest.update(nonce);
//     }
//     return digest.digest();
// }
//
// public static byte[] getPublicKey(byte[] keySeed) {
//     byte[] publicKey = new byte[32];
//     Curve25519.keygen(publicKey, null, Arrays.copyOf(keySeed, keySeed.length));
//     return publicKey;
// }
//
// public static byte[] getPublicKey(String secretPhrase) {
//     byte[] publicKey = new byte[32];
//     Curve25519.keygen(publicKey, null, Crypto.sha256().digest(Convert.toBytes(secretPhrase)));
//     return publicKey;
// }
//
// public static byte[] getPrivateKey(byte[] keySeed) {
//     byte[] s = Arrays.copyOf(keySeed, keySeed.length);
//     Curve25519.clamp(s);
//     return s;
// }
//
// public static byte[] getPrivateKey(String secretPhrase) {
//     byte[] s = Crypto.sha256().digest(Convert.toBytes(secretPhrase));
//     Curve25519.clamp(s);
//     return s;
// }
//
// public static void curve(byte[] Z, byte[] k, byte[] P) {
//     Curve25519.curve(Z, k, P);
// }
//
// public static byte[] sign(byte[] message, String secretPhrase) {
//     byte[] P = new byte[32];
//     byte[] s = new byte[32];
//     MessageDigest digest = Crypto.sha256();
//     Curve25519.keygen(P, s, digest.digest(Convert.toBytes(secretPhrase)));
//
//     byte[] m = digest.digest(message);
//
//     digest.update(m);
//     byte[] x = digest.digest(s);
//
//     byte[] Y = new byte[32];
//     Curve25519.keygen(Y, null, x);
//
//     digest.update(m);
//     byte[] h = digest.digest(Y);
//
//     byte[] v = new byte[32];
//     Curve25519.sign(v, h, x, s);
//
//     byte[] signature = new byte[64];
//     System.arraycopy(v, 0, signature, 0, 32);
//     System.arraycopy(h, 0, signature, 32, 32);
//     return signature;
// }
//
// public static boolean verify(byte[] signature, byte[] message, byte[] publicKey) {
//     try {
//         if (signature.length != 64) {
//             return false;
//         }
//         if (!Curve25519.isCanonicalSignature(signature)) {
//             Logger.logDebugMessage("Rejecting non-canonical signature");
//             return false;
//         }
//
//         if (!Curve25519.isCanonicalPublicKey(publicKey)) {
//             Logger.logDebugMessage("Rejecting non-canonical public key");
//             return false;
//         }
//
//         byte[] Y = new byte[32];
//         byte[] v = new byte[32];
//         System.arraycopy(signature, 0, v, 0, 32);
//         byte[] h = new byte[32];
//         System.arraycopy(signature, 32, h, 0, 32);
//         Curve25519.verify(Y, v, h, publicKey);
//
//         MessageDigest digest = Crypto.sha256();
//         byte[] m = digest.digest(message);
//         digest.update(m);
//         byte[] h2 = digest.digest(Y);
//
//         return Arrays.equals(h, h2);
//     } catch (RuntimeException e) {
//         Logger.logErrorMessage("Error verifying signature", e);
//         return false;
//     }
// }
//
// public static byte[] getSharedKey(byte[] myPrivateKey, byte[] theirPublicKey) {
//     return sha256().digest(getSharedSecret(myPrivateKey, theirPublicKey));
// }
//
// public static byte[] getSharedKey(byte[] myPrivateKey, byte[] theirPublicKey, byte[] nonce) {
//     byte[] dhSharedSecret = getSharedSecret(myPrivateKey, theirPublicKey);
//     for (int i = 0; i < 32; i++) {
//         dhSharedSecret[i] ^= nonce[i];
//     }
//     return sha256().digest(dhSharedSecret);
// }
//
// private static byte[] getSharedSecret(byte[] myPrivateKey, byte[] theirPublicKey) {
//     try {
//         byte[] sharedSecret = new byte[32];
//         Curve25519.curve(sharedSecret, myPrivateKey, theirPublicKey);
//         return sharedSecret;
//     } catch (RuntimeException e) {
//         Logger.logMessage("Error getting shared secret", e);
//         throw e;
//     }
// }
//
// public static byte[] aesEncrypt(byte[] plaintext, byte[] key) {
//     try {
//         byte[] iv = new byte[16];
//         secureRandom.get().nextBytes(iv);
//         PaddedBufferedBlockCipher aes = new PaddedBufferedBlockCipher(new CBCBlockCipher(
//             new AESEngine()));
//         CipherParameters ivAndKey = new ParametersWithIV(new KeyParameter(key), iv);
//         aes.init(true, ivAndKey);
//         byte[] output = new byte[aes.getOutputSize(plaintext.length)];
//         int ciphertextLength = aes.processBytes(plaintext, 0, plaintext.length, output, 0);
//         ciphertextLength += aes.doFinal(output, ciphertextLength);
//         byte[] result = new byte[iv.length + ciphertextLength];
//         System.arraycopy(iv, 0, result, 0, iv.length);
//         System.arraycopy(output, 0, result, iv.length, ciphertextLength);
//         return result;
//     } catch (InvalidCipherTextException e) {
//         throw new RuntimeException(e.getMessage(), e);
//     }
// }
//
// public static byte[] aesGCMEncrypt(byte[] plaintext, byte[] key) {
//     try {
//         byte[] iv = new byte[16];
//         secureRandom.get().nextBytes(iv);
//         GCMBlockCipher aes = new GCMBlockCipher(new AESEngine());
//         CipherParameters ivAndKey = new ParametersWithIV(new KeyParameter(key), iv);
//         aes.init(true, ivAndKey);
//         byte[] output = new byte[aes.getOutputSize(plaintext.length)];
//         int ciphertextLength = aes.processBytes(plaintext, 0, plaintext.length, output, 0);
//         ciphertextLength += aes.doFinal(output, ciphertextLength);
//         byte[] result = new byte[iv.length + ciphertextLength];
//         System.arraycopy(iv, 0, result, 0, iv.length);
//         System.arraycopy(output, 0, result, iv.length, ciphertextLength);
//         return result;
//     } catch (InvalidCipherTextException e) {
//         throw new RuntimeException(e.getMessage(), e);
//     }
// }
//
// public static byte[] aesDecrypt(byte[] ivCiphertext, byte[] key) {
//     try {
//         if (ivCiphertext.length < 16 || ivCiphertext.length % 16 != 0) {
//             throw new InvalidCipherTextException("invalid ivCiphertext length");
//         }
//         byte[] iv = Arrays.copyOfRange(ivCiphertext, 0, 16);
//         byte[] ciphertext = Arrays.copyOfRange(ivCiphertext, 16, ivCiphertext.length);
//         PaddedBufferedBlockCipher aes = new PaddedBufferedBlockCipher(new CBCBlockCipher(
//             new AESEngine()));
//         CipherParameters ivAndKey = new ParametersWithIV(new KeyParameter(key), iv);
//         aes.init(false, ivAndKey);
//         byte[] output = new byte[aes.getOutputSize(ciphertext.length)];
//         int plaintextLength = aes.processBytes(ciphertext, 0, ciphertext.length, output, 0);
//         plaintextLength += aes.doFinal(output, plaintextLength);
//         byte[] result = new byte[plaintextLength];
//         System.arraycopy(output, 0, result, 0, result.length);
//         return result;
//     } catch (InvalidCipherTextException e) {
//         throw new RuntimeException(e.getMessage(), e);
//     }
// }
//
// public static byte[] aesGCMDecrypt(byte[] ivCiphertext, byte[] key) {
//     try {
//         if (ivCiphertext.length < 16) {
//             throw new InvalidCipherTextException("invalid ivCiphertext length");
//         }
//         byte[] iv = Arrays.copyOfRange(ivCiphertext, 0, 16);
//         byte[] ciphertext = Arrays.copyOfRange(ivCiphertext, 16, ivCiphertext.length);
//         GCMBlockCipher aes = new GCMBlockCipher(new AESEngine());
//         CipherParameters ivAndKey = new ParametersWithIV(new KeyParameter(key), iv);
//         aes.init(false, ivAndKey);
//         byte[] output = new byte[aes.getOutputSize(ciphertext.length)];
//         int plaintextLength = aes.processBytes(ciphertext, 0, ciphertext.length, output, 0);
//         plaintextLength += aes.doFinal(output, plaintextLength);
//         byte[] result = new byte[plaintextLength];
//         System.arraycopy(output, 0, result, 0, result.length);
//         return result;
//     } catch (InvalidCipherTextException e) {
//         throw new RuntimeException(e.getMessage(), e);
//     }
// }
//
// public static String rsEncode(long id) {
//     return ReedSolomon.encode(id);
// }
//
// public static long rsDecode(String rsString) {
//     rsString = rsString.toUpperCase();
//     try {
//         long id = ReedSolomon.decode(rsString);
//         if (! rsString.equals(ReedSolomon.encode(id))) {
//             throw new RuntimeException("ERROR: Reed-Solomon decoding of " + rsString
//                 + " not reversible, decoded to " + id);
//         }
//         return id;
//     } catch (ReedSolomon.DecodeException e) {
//         Logger.logDebugMessage("Reed-Solomon decoding failed for " + rsString + ": " + e.toString());
//         throw new RuntimeException(e.toString(), e);
//     }
// }
//
// public static boolean isCanonicalPublicKey(byte[] publicKey) {
//     return Curve25519.isCanonicalPublicKey(publicKey);
// }
//
// public static boolean isCanonicalSignature(byte[] signature) {
//     return Curve25519.isCanonicalSignature(signature);
// }
//
// }
