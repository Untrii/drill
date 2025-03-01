import { createBinaryReader, createBinaryWriter, uuidBufferToString, uuidStringToBuffer } from '#lib/convert'
import { CommandType } from './command'

export interface EstablishConnectionCommand {
  type: CommandType.ESTABLISH_CONNECTION
  connectionId: string
  port: number
}

export const ESTABLISH_CONNECTION_COMMAND_SIZE = 10

export function createEstablishConnectionCommand(connectionId: string, port: number): EstablishConnectionCommand {
  return {
    type: CommandType.ESTABLISH_CONNECTION,
    connectionId: connectionId,
    port,
  }
}

export function encodeEstablishConnectionCommand(command: EstablishConnectionCommand): ArrayBuffer {
  const binaryWriter = createBinaryWriter()
  binaryWriter.writeArray(uuidStringToBuffer(command.connectionId))
  binaryWriter.writeUint16(command.port)

  return binaryWriter.toArrayBuffer()
}

export function decodeEstablishConnectionCommand(body: ArrayBuffer): EstablishConnectionCommand {
  const binaryReader = createBinaryReader(body)
  const id = uuidBufferToString(binaryReader.readArray())
  const port = binaryReader.readUint16()

  return {
    type: CommandType.ESTABLISH_CONNECTION,
    connectionId: id,
    port,
  }
}
