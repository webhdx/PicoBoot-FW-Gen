<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { RadioGroupRoot } from 'radix-vue'
import { cn } from '@/lib/utils/cn'

interface Props {
  modelValue?: string
  disabled?: boolean
  name?: string
  required?: boolean
  orientation?: 'horizontal' | 'vertical'
  dir?: 'ltr' | 'rtl'
  loop?: boolean
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  orientation: 'vertical',
  loop: true
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <RadioGroupRoot
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    :disabled="disabled"
    :name="name"
    :required="required"
    :orientation="orientation"
    :dir="dir"
    :loop="loop"
    :class="cn('grid gap-2', props.class)"
  >
    <slot />
  </RadioGroupRoot>
</template>
