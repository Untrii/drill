import { validator } from '#globals/validator'
import type { JSONSchemaType } from 'ajv'

export type Port = number
export const portSchema: JSONSchemaType<Port> = {
  type: 'number',
  minimum: 1,
  maximum: 65535,
}

export type PortRange = number[]
export const portRangeSchema: JSONSchemaType<PortRange> = {
  type: 'array',
  items: portSchema,
  minItems: 2,
  maxItems: 2,
}

export type NormalizedAddress = { host: string; port: number }
export type Address = string | NormalizedAddress
export const addressSchema: JSONSchemaType<Address> = {
  anyOf: [
    {
      type: 'string',
    },
    {
      type: 'object',
      properties: {
        host: {
          type: 'string',
        },
        port: {
          type: 'number',
        },
      },
      required: ['host', 'port'],
    },
  ],
}

export interface ForwardConfig {
  from: Address
  to: Address
}
export const forwardConfigSchema: JSONSchemaType<ForwardConfig> = {
  type: 'object',
  properties: {
    from: addressSchema,
    to: addressSchema,
  },
  required: ['from', 'to'],
}

export interface NodeConfig {
  address: Address
  password?: string
}

export const nodeConfigSchema: JSONSchemaType<NodeConfig> = {
  type: 'object',
  properties: {
    address: addressSchema,
    password: {
      type: 'string',
      nullable: true,
    },
  },
  required: ['address'],
}

export interface Config {
  password?: string
  exposePorts?: (Port | PortRange)[]
  nodePort?: Port
  nodes?: NodeConfig[]
  forward?: ForwardConfig[]
}
export const configSchema: JSONSchemaType<Config> = {
  type: 'object',
  properties: {
    password: {
      type: 'string',
      nullable: true,
    },

    exposePorts: {
      type: 'array',
      items: {
        anyOf: [portSchema, portRangeSchema],
      },
      nullable: true,
    },

    nodePort: { ...portSchema, nullable: true },

    nodes: {
      type: 'array',
      items: nodeConfigSchema,
      nullable: true,
    },

    forward: {
      type: 'array',
      items: forwardConfigSchema,
      nullable: true,
    },
  },
}

export const validateConfig = validator.compile(configSchema)
