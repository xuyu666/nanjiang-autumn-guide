// @vitest-environment node
import { describe, expect, it } from "vitest";
import { decryptApiKey, encryptApiKey } from "../../supabase/functions/_shared/api-key-crypto";

const TEST_SECRET = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
const TEST_OWNER = "user-test-a";

describe("API key encryption", () => {
  it("encrypts the key and restores it only with the same secret", async () => {
    const encrypted = await encryptApiKey(TEST_SECRET, "sk-test-private-value", TEST_OWNER);

    expect(encrypted.ciphertext).not.toContain("sk-test-private-value");
    expect(encrypted.iv).not.toBe("");
    await expect(decryptApiKey(TEST_SECRET, encrypted, TEST_OWNER)).resolves.toBe("sk-test-private-value");
    await expect(decryptApiKey("different-encryption-secret", encrypted, TEST_OWNER)).rejects.toThrow();
    await expect(decryptApiKey(TEST_SECRET, encrypted, "user-test-b")).rejects.toThrow();
  });

  it("uses a fresh nonce for each save", async () => {
    const first = await encryptApiKey(TEST_SECRET, "sk-test-private-value", TEST_OWNER);
    const second = await encryptApiKey(TEST_SECRET, "sk-test-private-value", TEST_OWNER);

    expect(first.iv).not.toBe(second.iv);
  });
});
