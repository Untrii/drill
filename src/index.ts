#!/usr/bin/env node

import '#globals/gc'
import { createAllocatePortCommand } from '#commands/allocate-port-command'
import { CommandType, type AnyCommand } from '#commands/command'
import { getMachineId } from '#lib/get-machine-id'
import { normalizeAddress, normalizePortRange } from '#lib/normalize'
import { validateConfig, type Config } from '#schemas/config.schema'
import { exit } from 'node:process'
import { createInboundForwarder } from './forward/create-inbound-forwarder'
import { createOutboundForwarder } from './forward/create-outbound-forwarder'
import { createInboundTransport, type InboundTransport } from './transport/inbound-transport'
import { createOutboundTransport, type OutboundTransport } from './transport/outbound-transport'
import { type TransportContext } from './transport/transport-context'
import fs from 'node:fs'

async function createDrill(config: Config) {
  const nodeId = getMachineId()
  console.log('Node ID:', nodeId)

  const canExposePort = (port: number) => {
    if (!config.exposePorts) return false

    for (const [portFrom, portTo] of config.exposePorts.map(normalizePortRange)) {
      if (portFrom <= port && port <= portTo) return true
    }

    return false
  }

  const getLinkedOutboundAddress = (nodeId: string, inboundPort: number) => {
    const transport = outboundTransports.find((transport) => transport.nodeId === nodeId)
    if (!transport) return null

    const nodeHost = transport.host
    const forwardConfig = config.forward?.find((forwardConfig) => {
      const normalizedAddress = normalizeAddress(forwardConfig.from)
      return normalizedAddress.host === nodeHost && normalizedAddress.port === inboundPort
    })

    if (!forwardConfig) return null
    return forwardConfig.to
  }

  const processIncomingCommands = async (command: AnyCommand, context: TransportContext) => {
    if (command.type === CommandType.ALLOCATE_PORT) {
      if (!canExposePort(command.port)) return
      inboundForwarder?.allocatePort(command.port, context.nodeId)
    }

    if (command.type === CommandType.ESTABLISH_CONNECTION) {
      const linkedAddress = getLinkedOutboundAddress(context.nodeId, command.port)
      if (!linkedAddress) return
      outboundForwarder.establishConnection(context.nodeId, command.connectionId, linkedAddress)
    }

    if (command.type === CommandType.CLOSE_CONNECTION) {
      inboundForwarder?.closeConnection(command.connectionId)
      outboundForwarder.closeConnection(command.connectionId)
    }

    if (command.type === CommandType.SEND_DATA) {
      inboundForwarder?.writeToConnection(command.connectionId, command.data)
      outboundForwarder?.writeToConnection(command.connectionId, command.data)
    }
  }

  let inboundTransport: InboundTransport | null = null
  if (config.nodePort)
    inboundTransport = await createInboundTransport(nodeId, config.password, config.nodePort, processIncomingCommands)

  let outboundTransports: OutboundTransport[] = []
  if (config.nodes) {
    outboundTransports = config.nodes.map((nodeConfig) =>
      createOutboundTransport(nodeId, nodeConfig.address, nodeConfig.password, processIncomingCommands)
    )
  }

  const writeCommandTo = async (nodeId: string, command: AnyCommand) => {
    const targetTransport = outboundTransports.find((transport) => transport.nodeId === nodeId)
    if (targetTransport) {
      await targetTransport.writeCommand(command)
    }

    await inboundTransport?.writeCommandTo(nodeId, command)
  }

  const inboundForwarder = config.exposePorts ? createInboundForwarder(writeCommandTo) : null
  const outboundForwarder = createOutboundForwarder(writeCommandTo)

  for (const forwardConfig of config.forward ?? []) {
    const normalizedFrom = normalizeAddress(forwardConfig.from)

    const targetTransport = outboundTransports.find((transport) => transport.host === normalizedFrom.host)
    if (!targetTransport) {
      console.warn(`Core: You didn't specified node with host ${normalizedFrom.host}`)
      continue
    }

    const allocatePortCommand = createAllocatePortCommand(normalizedFrom.port)
    targetTransport.writeCommand(allocatePortCommand).catch(() => {
      console.log('Core: Failed to start forwarding')
    })

    setInterval(() => {
      const allocatePortCommand = createAllocatePortCommand(normalizedFrom.port)
      targetTransport.writeCommand(allocatePortCommand).catch(() => {
        console.log('Core: Failed to start forwarding')
      })
    }, 10000)
  }
}

const defaultConfigFileName = 'drillrc.json'
const configFileName = process.argv[2] ?? defaultConfigFileName
if (!fs.existsSync(configFileName)) {
  console.log(
    `Core: Config file ${configFileName} not found. You have to create ${defaultConfigFileName} file or pass config file name as first argument.`
  )
  exit(1)
}

const config = JSON.parse(fs.readFileSync(configFileName, 'utf-8'))
const isConfigValid = validateConfig(config)

if (!isConfigValid) {
  console.log('Core: Invalid config')
  console.log(validateConfig.errors)
  exit(1)
}

createDrill(config)

setInterval(() => {
  const memoryUsage = process.memoryUsage()
  const prettifiedHeapUsage = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + 'MB'
  const prettifiedArrayBuffersUsage = (memoryUsage.arrayBuffers / 1024 / 1024).toFixed(2) + 'MB'

  console.log(`Core: Memory allocation:\nHeap: ${prettifiedHeapUsage}  ArrayBuffers: ${prettifiedArrayBuffersUsage}`)
}, 5000)
