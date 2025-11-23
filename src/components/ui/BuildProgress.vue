<script setup lang="ts">
import { computed } from 'vue'
import type { BuildStep } from '@/types/build'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Check, Loader2, Circle } from 'lucide-vue-next'

interface Props {
  steps: BuildStep[]
  currentStep?: string
  progress: number
}

const props = withDefaults(defineProps<Props>(), {
  progress: 0
})

const getStepIcon = (step: BuildStep) => {
  switch (step.status) {
    case 'completed':
      return Check
    case 'in_progress':
      return Loader2
    case 'error':
      return Circle
    default:
      return Circle
  }
}

const getStepClass = (step: BuildStep) => {
  switch (step.status) {
    case 'completed':
      return 'text-green-600'
    case 'in_progress':
      return 'text-primary animate-spin'
    case 'error':
      return 'text-destructive'
    default:
      return 'text-muted-foreground'
  }
}
</script>

<template>
  <Card v-if="steps.length > 0">
    <CardHeader>
      <CardTitle class="text-lg">Building Firmware...</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- Progress Bar -->
      <div class="space-y-2">
        <div class="flex justify-between text-sm">
          <span class="text-muted-foreground">Progress</span>
          <span class="font-medium">{{ Math.round(progress) }}%</span>
        </div>
        <Progress :model-value="progress" />
      </div>

      <!-- Steps List -->
      <div class="space-y-2">
        <div
          v-for="step in steps"
          :key="step.id"
          class="flex items-start space-x-2 text-sm"
        >
          <component
            :is="getStepIcon(step)"
            :class="['h-4 w-4 mt-0.5 flex-shrink-0', getStepClass(step)]"
          />
          <div class="flex-1">
            <span :class="step.status === 'in_progress' ? 'font-medium' : ''">
              {{ step.label }}
            </span>
            <p v-if="step.error" class="text-destructive text-xs mt-1">
              {{ step.error }}
            </p>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
