<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { RadioGroupRoot, type RadioGroupRootProps } from 'radix-vue'
import { cn } from '@/lib/utils/cn'

const props = defineProps<RadioGroupRootProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props

  return delegated
})
</script>

<template>
  <RadioGroupRoot
    v-bind="delegatedProps"
    :class="cn('grid gap-2', props.class)"
  >
    <slot />
  </RadioGroupRoot>
</template>
