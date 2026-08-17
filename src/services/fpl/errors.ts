export type FplDataErrorCode =
  | 'NETWORK_ERROR'
  | 'UPSTREAM_HTTP_ERROR'
  | 'UNEXPECTED_CONTENT_TYPE'
  | 'INVALID_JSON'
  | 'UNEXPECTED_SCHEMA'
  | 'MISSING_REQUIRED_MAPPING'
  | 'INVALID_PLAYER'

export class FplDataError extends Error {
  public readonly code: FplDataErrorCode

  constructor(
    code: FplDataErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'FplDataError'
    this.code = code
  }
}
