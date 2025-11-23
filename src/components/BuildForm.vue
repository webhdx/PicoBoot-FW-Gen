<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import { useBuildStore } from '@/stores/build'
import { fetchReleases } from '@/lib/github/releases'
import PicoBootSection from '@/components/sections/PicoBootSection.vue'
import PlatformSection from '@/components/sections/PlatformSection.vue'
import PayloadSection from '@/components/sections/PayloadSection.vue'
import BuildProgress from '@/components/ui/BuildProgress.vue'
import DownloadCard from '@/components/ui/DownloadCard.vue'
import { Button } from '@/components/ui/button'

const store = useBuildStore()

// Version lists
const picobootVersions = ref<Array<{ value: string; label: string }>>([
  { value: 'latest', label: 'Latest' },
])

const gekkobootVersions = ref<Array<{ value: string; label: string }>>([
  { value: 'latest', label: 'Latest' },
])

const picobootLoading = ref(false)
const gekkobootLoading = ref(false)

// Load versions from GitHub
onMounted(async () => {
  console.log('BuildForm mounted, loading versions...')

  // Load PicoBoot versions
  picobootLoading.value = true
  try {
    console.log('Fetching PicoBoot releases...')
    const releases = await fetchReleases('webhdx', 'PicoBoot')
    console.log('PicoBoot releases loaded:', releases.length)
    if (releases.length > 0) {
      picobootVersions.value = [
        { value: 'latest', label: `Latest (${releases[0].tag_name})` },
        ...releases.slice(0, 10).map(r => ({
          value: r.tag_name,
          label: r.tag_name
        }))
      ]
      console.log('PicoBoot versions:', picobootVersions.value)
    }
  } catch (error) {
    console.error('Failed to load PicoBoot versions:', error)
    toast.error('Failed to load PicoBoot versions', {
      description: 'Using cached data or defaults'
    })
  } finally {
    picobootLoading.value = false
  }

  // Load Gekkoboot versions
  gekkobootLoading.value = true
  try {
    const releases = await fetchReleases('webhdx', 'gekkoboot')
    if (releases.length > 0) {
      gekkobootVersions.value = [
        { value: 'latest', label: `Latest (${releases[0].tag_name})` },
        ...releases.slice(0, 10).map(r => ({
          value: r.tag_name,
          label: r.tag_name
        }))
      ]
    }
  } catch (error) {
    console.error('Failed to load Gekkoboot versions:', error)
    toast.error('Failed to load Gekkoboot versions', {
      description: 'Using cached data or defaults'
    })
  } finally {
    gekkobootLoading.value = false
  }
})

const handleBuild = async () => {
  await store.buildFirmware()
}
</script>

<template>
  <div class="space-y-6">
    <!-- PicoBoot Version Selection -->
    <PicoBootSection
      v-model="store.picobootVersion"
      :versions="picobootVersions"
      :loading="picobootLoading"
    />

    <!-- Platform Selection -->
    <PlatformSection v-model="store.platform" />

    <!-- Payload Selection -->
    <PayloadSection
      v-model="store.payloadVersion"
      :versions="gekkobootVersions"
      :loading="gekkobootLoading"
    />

    <!-- Build Button -->
    <div class="flex justify-center pt-4">
      <Button
        size="lg"
        :disabled="!store.canBuild"
        @click="handleBuild"
        class="min-w-[200px]"
      >
        <span v-if="!store.isBuilding">Build Firmware →</span>
        <span v-else>Building...</span>
      </Button>
    </div>

    <!-- Build Progress -->
    <BuildProgress
      v-if="store.isBuilding"
      :steps="store.buildSteps"
      :current-step="store.buildSteps.find(s => s.status === 'in_progress')?.id"
      :progress="store.buildProgress"
    />

    <!-- Download Card -->
    <DownloadCard
      v-if="store.firmwareDownloadUrl && store.firmwareData"
      :filename="store.firmwareFilename"
      :size="store.firmwareData.length"
      :sha256="store.firmwareChecksum"
      :download-url="store.firmwareDownloadUrl"
    />
  </div>
</template>
