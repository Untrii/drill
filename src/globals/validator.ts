import Ajv from 'ajv'
import AjvErrors from 'ajv-errors'

export const validator = new Ajv({
  allErrors: true,
})

AjvErrors(validator)
