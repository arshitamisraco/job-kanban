// Shared server-side env helpers.

// MOCK_MODE must never be honored in production, even if the env var leaks
// into a prod deployment by mistake.
export function isMockMode(): boolean {
  return process.env.MOCK_MODE === '1' && process.env.NODE_ENV !== 'production';
}
