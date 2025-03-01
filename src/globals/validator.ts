import Ajv from 'ajv'

export const validator = new Ajv({
  allErrors: true,
})
