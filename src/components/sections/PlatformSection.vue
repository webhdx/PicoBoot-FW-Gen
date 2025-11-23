<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

type Platform = 'RP2040' | 'RP2350'

interface Props {
  modelValue: Platform
}

interface Emits {
  (e: 'update:modelValue', value: Platform): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectedPlatform = computed({
  get: () => props.modelValue,
  set: (value: Platform) => emit('update:modelValue', value)
})

const platforms = [
  {
    value: 'RP2040' as const,
    label: 'RP2040',
    description: 'Raspberry Pi Pico / Pico W'
  },
  {
    value: 'RP2350' as const,
    label: 'RP2350',
    description: 'Raspberry Pi Pico 2 / Pico 2 W'
  }
]
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-lg">2. Platform</CardTitle>
    </CardHeader>
    <CardContent>
      <RadioGroup v-model="selectedPlatform">
        <div
          v-for="platform in platforms"
          :key="platform.value"
          class="flex items-center space-x-3 space-y-0"
        >
          <RadioGroupItem
            :id="`platform-${platform.value}`"
            :value="platform.value"
          />
          <Label
            :for="`platform-${platform.value}`"
            class="font-normal cursor-pointer flex flex-col"
          >
            <span class="font-medium">{{ platform.label }}</span>
            <span class="text-sm text-muted-foreground">{{ platform.description }}</span>
          </Label>
        </div>
      </RadioGroup>
    </CardContent>
  </Card>
</template>
