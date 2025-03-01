import { createBinaryReader, createBinaryWriter } from '#lib/convert'
import { CommandType, encodeCommand } from './command'

export interface AllocatePortCommand {
  type: CommandType.ALLOCATE_PORT
  port: number
}

export function createAllocatePortCommand(port: number): AllocatePortCommand {
  return {
    type: CommandType.ALLOCATE_PORT,
    port,
  }
}

export function encodePortAllocationCommand(command: AllocatePortCommand): ArrayBuffer {
  const binaryWriter = createBinaryWriter()
  binaryWriter.writeUint16(command.port)
  return binaryWriter.toArrayBuffer()
}

export function decodePortAllocationCommand(body: ArrayBuffer): AllocatePortCommand {
  const binaryReader = createBinaryReader(body)
  const port = binaryReader.readUint16()

  return { type: CommandType.ALLOCATE_PORT, port }
}
