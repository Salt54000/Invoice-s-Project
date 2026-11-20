export function isNetworkError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`.toLowerCase()
      : String(error).toLowerCase()

  return /failed to fetch|network|fetch failed|load failed|timeout|connection/.test(message)
}

export function isMissingAuthSession(error: {
  name?: string
  code?: string
}): boolean {
  return (
    error.name === 'AuthSessionMissingError' ||
    error.code === 'session_not_found'
  )
}