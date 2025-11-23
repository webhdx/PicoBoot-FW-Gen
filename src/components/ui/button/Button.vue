<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import type { ButtonVariants } from './index'
import { Primitive, type PrimitiveProps } from 'radix-vue'
import { buttonVariants } from './index'
import { cn } from '@/lib/utils/cn'

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
})

const delegatedProps = computed(() => {
  const { class: _, variant, size, ...delegated } = props

  return delegated
})
</script>

<template>
  <Primitive
    v-bind="delegatedProps"
    :class="cn(buttonVariants({ variant, size }), props.class)"
  >
    <slot />
  </Primitive>
</template>
