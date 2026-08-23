<script setup lang="ts">
import Giscus from "@giscus/vue";
import { computed } from "vue";
import { useData, useRoute } from "vitepress";
import { getGiscusProps } from "./giscus-config";

const route = useRoute();
const { isDark, lang } = useData();

const giscusProps = computed(() => getGiscusProps(lang.value, isDark.value));
</script>

<template>
  <div class="giscus-comments">
    <ClientOnly>
      <Giscus :key="route.path" v-bind="giscusProps" />
    </ClientOnly>
  </div>
</template>

<style scoped>
.giscus-comments {
  margin-top: 20px;
}
</style>
