import { createBinaryReader, createBinaryWriter, uuidBufferToString, uuidStringToBuffer } from '#lib/convert'
import { CommandType } from './command'

export interface SendDataCommand {
  type: CommandType.SEND_DATA
  data: ArrayBufferLike
  connectionId: string
}

export function createSendDataCommand(connectionId: string, data: ArrayBufferLike): SendDataCommand {
  return {
    type: CommandType.SEND_DATA,
    data,
    connectionId,
  }
}

export function encodeSendDataCommand(sendDataCommand: SendDataCommand) {
  const binaryWriter = createBinaryWriter()
  const connectionIdAsBuffer = uuidStringToBuffer(sendDataCommand.connectionId)
  binaryWriter.writeArray(connectionIdAsBuffer)
  binaryWriter.writeArray(sendDataCommand.data)
  return binaryWriter.toArrayBuffer()
}

export function decodeSendDataCommand(body: ArrayBuffer): SendDataCommand {
  const binaryReader = createBinaryReader(body)
  const connectionId = uuidBufferToString(binaryReader.readArray())
  const data = binaryReader.readArray()

  return {
    type: CommandType.SEND_DATA,
    connectionId,
    data,
  }
}
