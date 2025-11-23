import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { BuildStep, Platform } from '@/types/build'

export type { Platform, BuildStep }

export const useBuildStore = defineStore('build', () => {
  // State
  const picobootVersion = ref('latest')
  const platform = ref<Platform>('RP2040')
  const payloadVersion = ref('latest')

  const isBuilding = ref(false)
  const buildProgress = ref(0)
  const buildSteps = ref<BuildStep[]>([])

  const firmwareData = ref<Uint8Array | null>(null)
  const firmwareChecksum = ref('')
  const firmwareDownloadUrl = ref('')
  const firmwareFilename = ref('')

  // Computed
  const canBuild = computed(() => {
    return picobootVersion.value && platform.value && payloadVersion.value && !isBuilding.value
  })

  // Actions
  async function buildFirmware() {
    if (!canBuild.value) return

    isBuilding.value = true
    buildProgress.value = 0
    buildSteps.value = [
      { id: '1', label: 'Fetching PicoBoot firmware...', status: 'in_progress' },
      { id: '2', label: 'Fetching Gekkoboot payload...', status: 'pending' },
      { id: '3', label: 'Extracting DOL file...', status: 'pending' },
      { id: '4', label: 'Processing payload...', status: 'pending' },
      { id: '5', label: 'Generating UF2 blocks...', status: 'pending' },
      { id: '6', label: 'Merging firmware...', status: 'pending' },
      { id: '7', label: 'Calculating checksum...', status: 'pending' },
    ]

    try {
      // TODO: Implement actual build pipeline
      // For now, simulate the process

      // This is a placeholder - Phase 4 will connect to real GitHub API
      await new Promise(resolve => setTimeout(resolve, 2000))

      buildSteps.value[0].status = 'completed'
      buildProgress.value = 14

      await new Promise(resolve => setTimeout(resolve, 1000))
      buildSteps.value[1].status = 'completed'
      buildProgress.value = 28

      // ... continue for other steps

      firmwareFilename.value = `picoboot_gekkoboot_${platform.value.toLowerCase()}.uf2`

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const currentStep = buildSteps.value.find((s: BuildStep) => s.status === 'in_progress')
      if (currentStep) {
        currentStep.status = 'error'
        currentStep.error = errorMessage
      }
    } finally {
      isBuilding.value = false
    }
  }

  function reset() {
    isBuilding.value = false
    buildProgress.value = 0
    buildSteps.value = []
    firmwareData.value = null
    firmwareChecksum.value = ''
    firmwareDownloadUrl.value = ''
    firmwareFilename.value = ''
  }

  return {
    // State
    picobootVersion,
    platform,
    payloadVersion,
    isBuilding,
    buildProgress,
    buildSteps,
    firmwareData,
    firmwareChecksum,
    firmwareDownloadUrl,
    firmwareFilename,

    // Computed
    canBuild,

    // Actions
    buildFirmware,
    reset,
  }
})
