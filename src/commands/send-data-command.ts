import { CommandType, encodeCommand } from './command'

export interface SendDataCommand {
  type: CommandType.SEND_DATA
  data: ArrayBuffer
}

export function createSendDataCommand(data: ArrayBuffer) {
  return {
    type: CommandType.SEND_DATA,
    data,
  }
}

export function encodeSendDataCommand(sendDataCommand: SendDataCommand) {
  const { data } = sendDataCommand
  return data
}

export function decodeSendDataCommand(body: ArrayBuffer): SendDataCommand {
  return {
    type: CommandType.SEND_DATA,
    data: body,
  }
}
