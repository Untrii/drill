import { createBinaryReader, createBinaryWriter, uuidBufferToString, uuidStringToBuffer } from '#lib/convert'
import { CommandType, encodeCommand } from './command'

export interface HelloCommand {
  type: CommandType.HELLO
  nodeId: string
}

export function createHelloCommand(currentNodeId: string): HelloCommand {
  return {
    type: CommandType.HELLO,
    nodeId: currentNodeId,
  }
}

export function encodeClientHelloCommand(command: HelloCommand): ArrayBuffer {
  const binaryWriter = createBinaryWriter()
  binaryWriter.writeArray(uuidStringToBuffer(command.nodeId))
  return binaryWriter.toArrayBuffer()
}

export function decodeClientHelloCommand(body: ArrayBuffer): HelloCommand {
  const binaryReader = createBinaryReader(body)
  const id = uuidBufferToString(binaryReader.readArray())
  return { type: CommandType.HELLO, nodeId: id }
}
