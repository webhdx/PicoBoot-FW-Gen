import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import type { BuildStep, Platform } from '@/types/build'
import {
  downloadFirmwareAssetByPattern,
  downloadPayloadAssetByPattern,
  fetchLatestRelease,
  fetchReleaseByTag,
} from '@/lib/github/releases'
import { extractFromZipByPattern } from '@/lib/archive/zip-extractor'
import { parseDOLHeader, validateDOL } from '@/lib/firmware/dol-parser'
import { scramble } from '@/lib/firmware/scrambler'
import { wrapPayload } from '@/lib/firmware/payload-wrapper'
import { encodeToUF2 } from '@/lib/firmware/uf2-encoder'
import { mergeUF2, type MergeResult } from '@/lib/firmware/uf2-merger'
import { calculateSHA256 } from '@/lib/utils/checksum'
import { createDownloadURL } from '@/lib/storage/downloads'

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

  // Helper to update step status
  function updateStep(index: number, status: BuildStep['status'], error?: string) {
    if (buildSteps.value[index]) {
      buildSteps.value[index].status = status
      if (error) buildSteps.value[index].error = error
    }
  }

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
      // Step 1: Fetch PicoBoot base firmware
      const assetName = platform.value === 'RP2040' ? 'picoboot_pico.uf2' : 'picoboot_pico2.uf2'

      const release = picobootVersion.value === 'latest'
        ? await fetchLatestRelease('webhdx', 'PicoBoot')
        : await fetchReleaseByTag('webhdx', 'PicoBoot', picobootVersion.value)

      const baseFirmwareResult = await downloadFirmwareAssetByPattern(
        'webhdx',
        'PicoBoot',
        release.tag_name,
        new RegExp(assetName)
      )

      if (!baseFirmwareResult) {
        throw new Error(`Base firmware ${assetName} not found in release ${release.tag_name}`)
      }

      updateStep(0, 'completed')
      buildProgress.value = 14

      // Step 2: Fetch Gekkoboot payload
      updateStep(1, 'in_progress')

      const payloadRelease = payloadVersion.value === 'latest'
        ? await fetchLatestRelease('webhdx', 'gekkoboot')
        : await fetchReleaseByTag('webhdx', 'gekkoboot', payloadVersion.value)

      const payloadResult = await downloadPayloadAssetByPattern(
        'webhdx',
        'gekkoboot',
        payloadRelease.tag_name,
        /\.zip$/
      )

      if (!payloadResult) {
        throw new Error('Gekkoboot ZIP not found in release')
      }

      updateStep(1, 'completed')
      buildProgress.value = 28

      // Step 3: Extract DOL from ZIP
      updateStep(2, 'in_progress')

      const dolFile = await extractFromZipByPattern(payloadResult.data, /gekkoboot\.dol$/)
      if (!dolFile) {
        throw new Error('gekkoboot.dol not found in ZIP archive')
      }

      updateStep(2, 'completed')
      buildProgress.value = 42

      // Step 4: Process payload (parse, scramble, wrap)
      updateStep(3, 'in_progress')

      const dolHeader = parseDOLHeader(dolFile)
      validateDOL(dolHeader, dolFile)
      const scrambled = scramble(dolFile)
      const wrapped = wrapPayload(scrambled)

      updateStep(3, 'completed')
      buildProgress.value = 56

      // Step 5: Generate UF2 blocks
      updateStep(4, 'in_progress')

      const payloadUF2Result = encodeToUF2(wrapped, {
        familyId: platform.value,
        targetAddr: 0x10080000
      })

      updateStep(4, 'completed')
      buildProgress.value = 70

      // Step 6: Merge firmware
      updateStep(5, 'in_progress')

      const mergeResult = mergeUF2(baseFirmwareResult.data, payloadUF2Result.data)

      updateStep(5, 'completed')
      buildProgress.value = 85

      // Step 7: Calculate checksum
      updateStep(6, 'in_progress')

      firmwareData.value = mergeResult.data
      firmwareChecksum.value = await calculateSHA256(mergeResult.data)
      firmwareDownloadUrl.value = createDownloadURL(mergeResult.data, 'application/octet-stream', true)
      firmwareFilename.value = `picoboot_gekkoboot_${platform.value.toLowerCase()}.uf2`

      updateStep(6, 'completed')
      buildProgress.value = 100

      toast.success('Firmware built successfully!', {
        description: `File: ${firmwareFilename.value} (${(mergeResult.data.length / 1024).toFixed(0)} KB)`
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const currentStep = buildSteps.value.find((s: BuildStep) => s.status === 'in_progress')
      if (currentStep) {
        currentStep.status = 'error'
        currentStep.error = errorMessage
      }

      toast.error('Build failed', {
        description: errorMessage
      })
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
