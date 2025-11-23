<script setup lang="ts">
import { computed } from 'vue'
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectItemText,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  type SelectRootProps,
} from 'radix-vue'
import { ChevronDown } from 'lucide-vue-next'
import { cn } from '@/lib/utils/cn'

interface Props extends SelectRootProps {
  options: Array<{ value: string; label: string }>
  placeholder?: string
  class?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const delegatedProps = computed(() => {
  const { options, placeholder, class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <SelectRoot v-bind="delegatedProps" @update:model-value="emit('update:modelValue', $event)">
    <SelectTrigger
      :class="
        cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          props.class,
        )
      "
    >
      <SelectValue :placeholder="placeholder" />
      <ChevronDown class="h-4 w-4 opacity-50" />
    </SelectTrigger>
    <SelectContent
      class="relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
      :position="'popper'"
    >
      <SelectGroup class="p-1">
        <SelectItem
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          class="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
        >
          <SelectItemText>
            {{ option.label }}
          </SelectItemText>
        </SelectItem>
      </SelectGroup>
    </SelectContent>
  </SelectRoot>
</template>
