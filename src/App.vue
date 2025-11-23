<script setup lang="ts">
import BuildForm from '@/components/BuildForm.vue'
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <header class="border-b">
      <div class="container mx-auto px-4 py-6">
        <h1 class="text-3xl font-bold flex items-center gap-2">
          🎮 PicoBoot Firmware Generator
        </h1>
        <p class="text-sm text-muted-foreground mt-1">
          Client-side firmware builder for GameCube PicoBoot project
        </p>
      </div>
    </header>

    <!-- Main Content -->
    <main class="container mx-auto px-4 py-8 max-w-3xl">
      <BuildForm />
    </main>

    <!-- Footer -->
    <footer class="border-t mt-12">
      <div class="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
        <p>Phase 4: Basic UI (Gekkoboot Only)</p>
        <p class="mt-1">100% client-side • No data leaves your browser</p>
      </div>
    </footer>
  </div>
</template>
