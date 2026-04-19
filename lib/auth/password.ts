import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

const KEY_LENGTH = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString("hex")
  return `${salt}:${derivedKey}`
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const [salt, storedKeyHex] = passwordHash.split(":")
  if (!salt || !storedKeyHex) {
    return false
  }

  const derivedKey = scryptSync(password, salt, KEY_LENGTH)
  const storedKey = Buffer.from(storedKeyHex, "hex")

  if (storedKey.length !== derivedKey.length) {
    return false
  }

  return timingSafeEqual(storedKey, derivedKey)
}
