import { createBinaryReader, createBinaryWriter, uuidBufferToString, uuidStringToBuffer } from '#lib/convert'
import { CommandType } from './command'

export interface CloseConnectionCommand {
  type: CommandType.CLOSE_CONNECTION
  connectionId: string
  port: number
}

export function createCloseConnectionCommand(connectionId: string, port: number): CloseConnectionCommand {
  return {
    type: CommandType.CLOSE_CONNECTION,
    connectionId: connectionId,
    port,
  }
}

export function encodeCloseConnectionCommand(command: CloseConnectionCommand): ArrayBuffer {
  const binaryWriter = createBinaryWriter()
  binaryWriter.write(uuidStringToBuffer(command.connectionId))
  binaryWriter.writeUint16(command.port)
  return binaryWriter.toArrayBuffer()
}

export function decodeCloseConnectionCommand(body: ArrayBuffer): CloseConnectionCommand {
  const binaryReader = createBinaryReader(body)
  const id = uuidBufferToString(binaryReader.readArray())
  const port = binaryReader.readUint16()
  return { type: CommandType.CLOSE_CONNECTION, connectionId: id, port }
}
