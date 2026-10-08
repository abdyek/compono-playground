<script setup lang="ts">
import { computed } from 'vue'

// Compono messages emphasize values with **; nothing else is markup.
const props = defineProps<{ text: string }>()

const parts = computed(() => props.text.split('**').map((text, i) => ({ text, strong: i % 2 === 1 })))
</script>

<template>
  <span>
    <template v-for="(part, i) in parts" :key="i">
      <code v-if="part.strong">{{ part.text }}</code>
      <template v-else>{{ part.text }}</template>
    </template>
  </span>
</template>

<style scoped>
code {
  font-family: var(--mono);
  font-size: 0.92em;
  padding: 0 0.25em;
  border-radius: 4px;
  background: var(--accent-soft);
}
</style>
