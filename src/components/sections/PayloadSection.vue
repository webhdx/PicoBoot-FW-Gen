<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface Props {
  modelValue: string
  versions: Array<{ value: string; label: string }>
  loading?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<Emits>()

const selectedVersion = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value)
})
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-lg">3. Payload</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="space-y-2">
        <Label for="payload-type">Type</Label>
        <div class="flex items-center space-x-2">
          <span class="text-sm font-medium">Gekkoboot</span>
          <span class="text-xs text-muted-foreground">(Phase 4: Hardcoded)</span>
        </div>
      </div>

      <div class="space-y-2">
        <Label for="payload-version">Version</Label>
        <Select
          id="payload-version"
          v-model="selectedVersion"
          :options="versions"
          placeholder="Select version..."
          :disabled="loading"
        />
      </div>

      <div class="rounded-lg bg-muted p-3">
        <p class="text-sm text-muted-foreground">
          <strong>Gekkoboot</strong> - Minimal GameCube IPL bootloader (~600 KB)
        </p>
      </div>
    </CardContent>
  </Card>
</template>
