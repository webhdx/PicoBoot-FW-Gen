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
      <CardTitle class="text-lg">1. PicoBoot Version</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="space-y-2">
        <Label for="picoboot-version">Version</Label>
        <Select
          id="picoboot-version"
          v-model="selectedVersion"
          :options="versions"
          placeholder="Select version..."
          :disabled="loading"
        />
      </div>
      <p class="text-sm text-muted-foreground">
        Select the PicoBoot firmware version to use as the base.
      </p>
    </CardContent>
  </Card>
</template>
