import { createAllocatePortCommand } from '#commands/allocate-port-command'
import { normalizeAddress } from '#lib/normalize'
import type { Config } from '#schemas/config.schema'
import { createInboundTransport } from './transport/inbound-transport'
import { createOutboundTransport } from './transport/outbound-transport'

async function createDrill(config: Config) {
  const clientId = crypto.randomUUID()

  const inboundTransport = config.nodePort ? await createInboundTransport(config.password) : null
  if (inboundTransport) {
    while (true) {
      const { command } = await inboundTransport.readCommand()
      console.log('Server: Received command', command.type)
    }
  }

  const outboundTransports =
    config.nodes?.map((nodeConfig) => {
      const normalizedAddress = normalizeAddress(nodeConfig.address)
      const transport = createOutboundTransport(clientId, normalizedAddress, nodeConfig.password)
      return transport
    }) ?? []

  for (const forwardConfig of config.forward ?? []) {
    const normalizedFrom = normalizeAddress(forwardConfig.from)
    const allocatePortCommand = createAllocatePortCommand(normalizedFrom.port)

    const targetTransport = outboundTransports.find((transport) => transport.host === normalizedFrom.host)

    setInterval(async () => {
      try {
        await targetTransport?.writeCommand(allocatePortCommand)
        console.log('Sent allocate port command')
      } catch (error) {
        console.error(error)
      }
    }, 1000)
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
