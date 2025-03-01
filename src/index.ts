import { createAllocatePortCommand } from '#commands/allocate-port-command'
import { CommandType, type AnyCommand } from '#commands/command'
import { normalizeAddress, normalizePortRange } from '#lib/normalize'
import type { Config } from '#schemas/config.schema'
import { createInboundForwarder } from './forward/create-inbound-forwarder'
import { createOutboundForwarder } from './forward/create-outbound-forwarder'
import { createInboundTransport, type InboundTransport } from './transport/inbound-transport'
import { createOutboundTransport, type OutboundTransport } from './transport/outbound-transport'
import type { TransportContext } from './transport/transport-context'

async function createDrill(config: Config) {
  const nodeId =
    process.argv[2] === 'server' ? '6336c896-5b17-437e-8556-cf9b4a50060b' : '9de1aabf-38f1-4119-a1a0-197104719119'
  console.log('Node ID:', nodeId)

  const canExposePort = (port: number) => {
    if (!config.exposePorts) return false

    for (const [portFrom, portTo] of config.exposePorts.map(normalizePortRange)) {
      if (portFrom <= port && port <= portTo) return true
    }

    return false
  }

  const getLinkedPort = (nodeId: string, port: number) => {
    const transport = outboundTransports.find((transport) => transport.nodeId === nodeId)
    if (!transport) return null

    const nodeHost = transport.host
    const forwardConfig = config.forward?.find((forwardConfig) => {
      const normalizedAddress = normalizeAddress(forwardConfig.from)
      return normalizedAddress.host === nodeHost && normalizedAddress.port === port
    })

    if (!forwardConfig) return null
    return normalizeAddress(forwardConfig.to).port
  }

  const processIncomingCommands = async (command: AnyCommand, context: TransportContext) => {
    if (command.type === CommandType.ALLOCATE_PORT) {
      if (!canExposePort(command.port)) return
      inboundForwarder?.allocatePort(command.port, context.nodeId)
    }

    if (command.type === CommandType.ESTABLISH_CONNECTION) {
      const linkedPort = getLinkedPort(context.nodeId, command.port)
      if (!linkedPort) return
      outboundForwarder.establishConnection(context.nodeId, command.connectionId, linkedPort)
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
      console.warn(`You didn't specified node with host ${normalizedFrom.host}`)
      continue
    }

    const allocatePortCommand = createAllocatePortCommand(normalizedFrom.port)
    targetTransport.writeCommand(allocatePortCommand).catch(() => {
      console.log('Failed to start forwarding')
    })

    setInterval(() => {
      const allocatePortCommand = createAllocatePortCommand(normalizedFrom.port)
      targetTransport.writeCommand(allocatePortCommand).catch(() => {
        console.log('Failed to start forwarding')
      })
    }, 10000)
  }
}

const clientConfig: Config = {
  nodes: [
    {
      address: 'localhost:8035',
      password: 'password',
    },
  ],
  forward: [
    {
      from: {
        host: 'localhost',
        port: 45123,
      },
      to: {
        host: 'localhost',
        port: 3000,
      },
    },
  ],
}

const serverConfig: Config = {
  nodePort: 8035,
  password: 'password',
  exposePorts: [[45000, 46000]],
}

if (process.argv[2] === 'client') createDrill(clientConfig)
if (process.argv[2] === 'server') createDrill(serverConfig)
