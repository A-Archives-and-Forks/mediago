<template>
  <footer
    class="relative z-[1]"
    :class="{ 'lg:pl-[var(--vp-sidebar-width)] lg:m-0': hasSidebar }"
  >
    <div
      class="relative px-6 py-8 border-t border-[var(--vp-c-divider)] bg-[var(--vp-c-bg)] mx-auto max-w-[1200px]"
    >
      <!-- 顶部区域 -->
      <div class="flex flex-col md:flex-row justify-between -mx-3 pb-6">
        <!-- Logo部分 -->
        <div class="px-3 flex-shrink-0 md:flex-1 max-w-full">
          <img src="/favicon.ico" alt="MediaGo Logo" class="w-10 h-10" />
          <div class="text-base font-semibold my-1 text-[var(--vp-c-text-1)]">
            MediaGo
          </div>
          <div class="text-sm text-[var(--vp-c-text-2)]">{{ t("slogan") }}</div>
        </div>

        <div class="flex flex-col md:flex-row gap-8 md:gap-12">
          <!-- 帮助链接部分 -->
          <div class="px-3 text-sm flex-shrink-0 min-w-[150px] mt-8 md:mt-0">
            <div class="font-semibold mb-2 text-[var(--vp-c-text-1)]">
              {{ t("help") }}
            </div>
            <ul class="list-none m-0 p-0">
              <li class="mb-1">
                <a
                  href="/blog/"
                  class="text-[var(--vp-c-text-2)] no-underline transition-colors hover:text-[var(--vp-c-text-1)] duration-300"
                >
                  {{ t("blog") }}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- 底部版权信息 -->
      <div
        class="border-t border-[var(--vp-c-divider)] pt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-sm text-[var(--vp-c-text-2)]"
      >
        <div class="copyright">
          Copyright © {{ new Date().getFullYear() }} MediaGo. All rights
          reserved.
        </div>
        <div class="flex gap-4">
          <a
            href="/privacy"
            class="text-[var(--vp-c-text-2)] no-underline transition-colors hover:text-[var(--vp-c-text-1)] duration-300"
          >
            {{ t("privacy") }}
          </a>
          <a
            href="https://beian.miit.gov.cn"
            target="_blank"
            rel="noopener noreferrer"
            class="text-[var(--vp-c-text-2)] no-underline transition-colors hover:text-[var(--vp-c-text-1)] duration-300"
          >
            豫ICP备20012967号-2
          </a>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";
import { useLayout } from "vitepress/theme";

const messages = {
  en: {
    slogan: "Easy to use, fast download",
    help: "Help",
    blog: "Blog",
    privacy: "Privacy Policy",
  },
  jp: {
    slogan: "使いやすく、ダウンロードも速い",
    help: "ヘルプ",
    blog: "ブログ",
    privacy: "プライバシーポリシー",
  },
  zh: {
    slogan: "简单易用，快速下载",
    help: "帮助",
    blog: "博客",
    privacy: "隐私政策",
  },
  it: {
    slogan: "Facile da usare, download veloce",
    help: "Aiuto",
    blog: "Blog",
    privacy: "Informativa sulla privacy",
  },
} as const;

type MessageKey = keyof (typeof messages)["zh"];
type SupportedLocale = keyof typeof messages;

function isSupportedLocale(locale: string): locale is SupportedLocale {
  return (
    locale === "en" || locale === "jp" || locale === "zh" || locale === "it"
  );
}

const { lang } = useData();
const { hasSidebar } = useLayout();
const localizedMessages = computed(() =>
  isSupportedLocale(lang.value) ? messages[lang.value] : messages.zh,
);

function t(key: MessageKey) {
  return localizedMessages.value[key];
}
</script>
