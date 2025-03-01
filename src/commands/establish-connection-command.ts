import crypto from 'node:crypto'
import { createBinaryReader, createBinaryWriter, uuidBufferToString, uuidStringToBuffer } from '#lib/convert'
import { CommandType, encodeCommand } from './command'

export interface EstablishConnectionCommand {
  type: CommandType.ESTABLISH_CONNECTION
  id: string
  port: number
}

export const ESTABLISH_CONNECTION_COMMAND_SIZE = 10

export function createEstablishConnectionCommand(port: number) {
  const id = crypto.randomUUID()

  return {
    type: CommandType.ESTABLISH_CONNECTION,
    id,
    port,
  }
}

export function encodeEstablishConnectionCommand(command: EstablishConnectionCommand): ArrayBuffer {
  const binaryWriter = createBinaryWriter()
  binaryWriter.writeArray(uuidStringToBuffer(command.id))
  binaryWriter.writeUint16(command.port)

  return binaryWriter.toArrayBuffer()
}

export function decodeConnectionCommand(body: ArrayBuffer): EstablishConnectionCommand {
  const binaryReader = createBinaryReader(body)
  const id = uuidBufferToString(binaryReader.readArray())
  const port = binaryReader.readUint8()

  return {
    type: CommandType.ESTABLISH_CONNECTION,
    id,
    port,
  }
}
