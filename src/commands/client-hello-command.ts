import { createBinaryReader, createBinaryWriter, uuidBufferToString, uuidStringToBuffer } from '#lib/convert'
import { CommandType, encodeCommand } from './command'

export interface ClientHelloCommand {
  type: CommandType.CLIENT_HELLO
  id: string
}

export function createClientHelloCommand(id: string): ClientHelloCommand {
  return {
    type: CommandType.CLIENT_HELLO,
    id,
  }
}

export function encodeClientHelloCommand(command: ClientHelloCommand): ArrayBuffer {
  const binaryWriter = createBinaryWriter()
  binaryWriter.writeArray(uuidStringToBuffer(command.id))
  return binaryWriter.toArrayBuffer()
}

export function decodeClientHelloCommand(body: ArrayBuffer): ClientHelloCommand {
  const binaryReader = createBinaryReader(body)
  const id = uuidBufferToString(binaryReader.readArray())
  return { type: CommandType.CLIENT_HELLO, id }
}
