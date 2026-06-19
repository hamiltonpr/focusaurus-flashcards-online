import * as ExpoCrypto from "expo-crypto"

// Supabase auth-js needs crypto.subtle for PKCE (S256). React Native doesn't provide it.
if (typeof globalThis.crypto?.subtle?.digest !== "function") {
  const getRandomValues = ExpoCrypto.getRandomValues.bind(ExpoCrypto)

  globalThis.crypto = {
    getRandomValues,
    subtle: {
      digest: (algorithm: string, data: BufferSource) => {
        const algo = algorithm.toUpperCase().replace("-", "")
        if (algo !== "SHA256") {
          return Promise.reject(new Error(`Unsupported digest algorithm: ${algorithm}`))
        }
        return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data)
      },
    },
  } as Crypto
}
