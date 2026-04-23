import { describe, expect, it } from "vitest"

import { hashPassword, verifyPassword } from "@/lib/auth/password"

describe("hashPassword", () => {
  it("should_return_salt_and_hash_segments_when_password_is_valid", () => {
    const hash = hashPassword("correct horse battery staple")
    const [salt, key] = hash.split(":")

    expect(salt).toBeTruthy()
    expect(key).toBeTruthy()
    expect(salt).toHaveLength(32)
    expect(key).toHaveLength(128)
  })

  it("should_generate_different_hashes_when_same_password_is_hashed_twice", () => {
    const one = hashPassword("same-password")
    const two = hashPassword("same-password")

    expect(one).not.toBe(two)
  })
})

describe("verifyPassword", () => {
  it("should_return_true_when_password_matches_hash", () => {
    const password = "my-passphrase"
    const hash = hashPassword(password)

    expect(verifyPassword(password, hash)).toBe(true)
  })

  it("should_return_false_when_password_does_not_match_hash", () => {
    const hash = hashPassword("expected-password")

    expect(verifyPassword("wrong-password", hash)).toBe(false)
  })

  it("should_return_false_when_hash_format_is_invalid", () => {
    expect(verifyPassword("password", "invalid-format")).toBe(false)
  })

  it("should_return_false_when_stored_key_length_is_invalid", () => {
    expect(verifyPassword("password", "abcd:12")).toBe(false)
  })
})
