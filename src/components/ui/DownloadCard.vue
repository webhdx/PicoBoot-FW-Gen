<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Copy, Check } from 'lucide-vue-next'
import { ref } from 'vue'

interface Props {
  filename: string
  size: number
  sha256: string
  downloadUrl: string
}

const props = defineProps<Props>()

const copied = ref(false)

const formattedSize = computed(() => {
  const kb = props.size / 1024
  if (kb < 1024) {
    return `${kb.toFixed(2)} KB`
  }
  const mb = kb / 1024
  return `${mb.toFixed(2)} MB`
})

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(props.sha256)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}
</script>

<template>
  <Card class="border-primary/50">
    <CardHeader>
      <CardTitle class="text-lg flex items-center gap-2">
        <Download class="h-5 w-5" />
        Download Ready
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- File Info -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">Filename:</span>
          <span class="text-sm text-muted-foreground font-mono">{{ filename }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">Size:</span>
          <span class="text-sm text-muted-foreground">{{ formattedSize }}</span>
        </div>
      </div>

      <!-- SHA256 -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">SHA256:</span>
          <Button
            variant="ghost"
            size="sm"
            @click="copyToClipboard"
            class="h-6 px-2"
          >
            <Check v-if="copied" class="h-3 w-3 text-green-600" />
            <Copy v-else class="h-3 w-3" />
          </Button>
        </div>
        <div class="rounded-md bg-muted p-2 font-mono text-xs break-all">
          {{ sha256 }}
        </div>
      </div>

      <!-- Download Button -->
      <a
        :href="downloadUrl"
        :download="filename"
        class="block"
      >
        <Button class="w-full" size="lg">
          <Download class="h-4 w-4 mr-2" />
          Download Firmware
        </Button>
      </a>

      <p class="text-xs text-muted-foreground text-center">
        Flash this UF2 file to your Raspberry Pi Pico by dragging it to the mounted drive
      </p>
    </CardContent>
  </Card>
</template>
