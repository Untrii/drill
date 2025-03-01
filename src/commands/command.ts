import { createBinaryReader, createBinaryWriter } from '#lib/convert'
import {
  decodePortAllocationCommand,
  encodePortAllocationCommand,
  type AllocatePortCommand,
} from './allocate-port-command'
import { decodeAuthCommand, encodeAuthCommand, type AuthCommand } from './auth-command'
import { decodeClientHelloCommand, encodeClientHelloCommand, type HelloCommand } from './hello-command'
import {
  decodeCloseConnectionCommand,
  encodeCloseConnectionCommand,
  type CloseConnectionCommand,
} from './close-connetion-command'
import {
  decodeEstablishConnectionCommand,
  encodeEstablishConnectionCommand,
  type EstablishConnectionCommand,
} from './establish-connection-command'
import { decodeSendDataCommand, encodeSendDataCommand, type SendDataCommand } from './send-data-command'

export enum CommandType {
  AUTH = 0x00,
  HELLO = 0x01,
  ALLOCATE_PORT = 0x10,
  ESTABLISH_CONNECTION = 0x11,
  CLOSE_CONNECTION = 0x12,
  SEND_DATA = 0x20,
}

export type AnyCommand =
  | AuthCommand
  | HelloCommand
  | AllocatePortCommand
  | EstablishConnectionCommand
  | SendDataCommand
  | CloseConnectionCommand

const COMMAND_TYPE_SIZE = 1
const COMMAND_RESERVE_SIZE = 3

const encodeByType = {
  [CommandType.AUTH]: encodeAuthCommand,
  [CommandType.HELLO]: encodeClientHelloCommand,
  [CommandType.ALLOCATE_PORT]: encodePortAllocationCommand,
  [CommandType.ESTABLISH_CONNECTION]: encodeEstablishConnectionCommand,
  [CommandType.CLOSE_CONNECTION]: encodeCloseConnectionCommand,
  [CommandType.SEND_DATA]: encodeSendDataCommand,
}

export function encodeCommand(command: AnyCommand) {
  const encode = encodeByType[command.type]
  const commandBody = encode(command as any)

  const binaryWriter = createBinaryWriter()
  binaryWriter.writeUint8(command.type)
  binaryWriter.writeBlank(COMMAND_RESERVE_SIZE)
  binaryWriter.writeArray(commandBody)
  return binaryWriter.toArrayBuffer()
}

export interface CommandLayout {
  type: CommandType
  body: ArrayBuffer
  size: number
}

export class InvalidCommandTypeError extends Error {
  constructor() {
    super('Invalid command type')
  }
}

const decoderByType = {
  [CommandType.AUTH]: decodeAuthCommand,
  [CommandType.HELLO]: decodeClientHelloCommand,
  [CommandType.ALLOCATE_PORT]: decodePortAllocationCommand,
  [CommandType.ESTABLISH_CONNECTION]: decodeEstablishConnectionCommand,
  [CommandType.CLOSE_CONNECTION]: decodeCloseConnectionCommand,
  [CommandType.SEND_DATA]: decodeSendDataCommand,
}

interface DecodeCommandResult {
  command: AnyCommand
  size: number
}
export function decodeCommand(buffer: ArrayBuffer): DecodeCommandResult {
  const binaryReader = createBinaryReader(buffer)

  const type = binaryReader.readUint8() as CommandType
  binaryReader.skip(COMMAND_RESERVE_SIZE)
  const body = binaryReader.readArray()
  const size = binaryReader.position

  const decode = decoderByType[type]

  const command = decode(body as ArrayBuffer)
  return {
    command,
    size,
  }
}
