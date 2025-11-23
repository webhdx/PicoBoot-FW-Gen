<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBuildStore } from '@/stores/build'
import PicoBootSection from '@/components/sections/PicoBootSection.vue'
import PlatformSection from '@/components/sections/PlatformSection.vue'
import PayloadSection from '@/components/sections/PayloadSection.vue'
import BuildProgress from '@/components/ui/BuildProgress.vue'
import DownloadCard from '@/components/ui/DownloadCard.vue'
import { Button } from '@/components/ui/button'

const store = useBuildStore()

// Mock data for Phase 4 (Gekkoboot only)
const picobootVersions = ref([
  { value: 'latest', label: 'Latest (v0.5.0)' },
  { value: 'v0.5.0', label: 'v0.5.0' },
  { value: 'v0.4.0', label: 'v0.4.0' },
])

const gekkobootVersions = ref([
  { value: 'latest', label: 'Latest (r9.4)' },
  { value: 'r9.4', label: 'r9.4' },
  { value: 'r9.3', label: 'r9.3' },
])

const picobootLoading = ref(false)
const gekkobootLoading = ref(false)

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
