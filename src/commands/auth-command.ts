import crypto from 'node:crypto'
import { CommandType, encodeCommand } from './command'
import { createBinaryReader, createBinaryWriter } from '#lib/convert'

export interface AuthCommand {
  type: CommandType.AUTH
  signature: ArrayBuffer
}

const PASSWORD_HASHING_SETTINGS = {
  algorithm: 'argon2d' as const,
  memoryCost: 8,
  timeCost: 3,
}

const AUTH_COMMAND_LIFETIME_MS = 5 * 60 * 1000
const AUTH_SIGNATURE_TIMESTAMP_LENGTH = 8
const AUTH_SIGNATURE_HASH_LENGTH = 32

export async function createAuthCommand(password: string): Promise<AuthCommand> {
  const timestamp = Date.now()
  const signatureHash = crypto.createHash('sha256').update(timestamp.toString()).update(password).digest()

  const binaryWriter = createBinaryWriter()
  binaryWriter.writeUint64(timestamp)
  binaryWriter.write(signatureHash.buffer)

  return { type: CommandType.AUTH, signature: binaryWriter.toArrayBuffer() }
}

export type AuthValidationErrorSlug = 'invalid_data' | 'expired' | 'password_mismatch'

export class AuthValidationError extends Error {
  constructor(message: string) {
    super(`Auth validation failed: ${message}`)
  }
}

export async function validateAuthCommand(password: string, authCommand: AuthCommand): Promise<void> {
  const signature = authCommand.signature
  if (signature.byteLength !== AUTH_SIGNATURE_TIMESTAMP_LENGTH + AUTH_SIGNATURE_HASH_LENGTH) {
    throw new AuthValidationError('Invalid signature length')
  }

  const binaryReader = createBinaryReader(signature)
  const timestamp = binaryReader.readUint64()
  const timestampAsNumber = Number(timestamp)
  const signatureHash = binaryReader.read(AUTH_SIGNATURE_HASH_LENGTH, (data) => data as ArrayBuffer)

  if (Math.abs(timestampAsNumber - Date.now()) > AUTH_COMMAND_LIFETIME_MS) {
    throw new AuthValidationError('Signature expired. Check system time if problem persists')
  }

  //const hashedPassword = await Bun.password.hash(password, PASSWORD_HASHING_SETTINGS)
  const expectedSignatureHash = crypto.createHash('sha256').update(timestamp.toString()).update(password).digest()

  if (!crypto.timingSafeEqual(new DataView(signatureHash), expectedSignatureHash)) {
    throw new AuthValidationError('Password mismatch')
  }
}

export function encodeAuthCommand(authCommand: AuthCommand): ArrayBuffer {
  const { signature } = authCommand
  return signature
}

export function decodeAuthCommand(body: ArrayBuffer): AuthCommand {
  return { type: CommandType.AUTH, signature: body }
}
