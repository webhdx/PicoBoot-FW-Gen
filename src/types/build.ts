/**
 * Build step status during firmware generation
 */
export type BuildStepStatus = 'pending' | 'in_progress' | 'completed' | 'error'

/**
 * Build step information
 */
export interface BuildStep {
  id: string
  label: string
  status: BuildStepStatus
  error?: string
}

/**
 * Platform type for PicoBoot
 */
export type Platform = 'RP2040' | 'RP2350'
