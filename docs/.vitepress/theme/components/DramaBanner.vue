<script setup lang="ts">
import { inBrowser } from "vitepress";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const isVisible = ref(true);

function setBannerVisibility(visible: boolean) {
  if (inBrowser) {
    document.documentElement.classList.toggle("drama-banner-hidden", !visible);
  }
}

function closeBanner() {
  isVisible.value = false;
  setBannerVisibility(false);
}

onMounted(() => setBannerVisibility(true));
onBeforeUnmount(() => {
  if (inBrowser) {
    document.documentElement.classList.remove("drama-banner-hidden");
  }
});
</script>

<template>
  <aside v-if="isVisible" class="drama-banner" :aria-label="t('banner.label')">
    <div class="drama-banner__dots" aria-hidden="true"></div>
    <div class="drama-banner__inner">
      <div class="drama-banner__brand">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 1.75c.42 4.93 3.32 7.83 8.25 8.25-4.93.42-7.83 3.32-8.25 8.25C9.58 13.32 6.68 10.42 1.75 10 6.68 9.58 9.58 6.68 10 1.75Z"
          />
        </svg>
        <span>MediaGo <strong>Drama</strong></span>
      </div>

      <span class="drama-banner__divider" aria-hidden="true"></span>

      <div class="drama-banner__promotion">
        <span class="drama-banner__lead">{{ t("banner.badge") }}</span>
        <strong>{{ t("banner.title") }}</strong>
      </div>

      <a
        class="drama-banner__action"
        href="https://mediago.torchstellar.com/"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="t('banner.actionLabel')"
      >
        <span>{{ t("banner.action") }}</span>
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4 10h11m-4-4 4 4-4 4" />
        </svg>
      </a>

      <button
        type="button"
        class="drama-banner__close"
        :aria-label="t('banner.close')"
        @click="closeBanner"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m5.5 5.5 9 9m0-9-9 9" />
        </svg>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.drama-banner {
  position: fixed;
  inset: 0 0 auto;
  z-index: var(--vp-z-index-layout-top);
  height: var(--vp-layout-top-height);
  overflow: hidden;
  color: #17223b;
  background:
    radial-gradient(
      circle at 14% -80%,
      rgba(45, 136, 255, 0.22),
      transparent 45%
    ),
    radial-gradient(
      circle at 88% 180%,
      rgba(255, 185, 82, 0.2),
      transparent 32%
    ),
    rgba(250, 253, 255, 0.96);
  border-bottom: 1px solid rgba(47, 112, 219, 0.16);
  box-shadow: 0 8px 24px rgba(46, 91, 151, 0.08);
  backdrop-filter: blur(18px) saturate(1.25);
}

.drama-banner::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 3%,
    #3b82f6 28%,
    #22b8cf 68%,
    transparent 97%
  );
  content: "";
  opacity: 0.72;
}

.drama-banner__dots {
  position: absolute;
  inset: 0;
  opacity: 0.22;
  pointer-events: none;
  background-image: radial-gradient(
    circle,
    rgba(49, 114, 217, 0.3) 0.8px,
    transparent 0.9px
  );
  background-size: 15px 15px;
  mask-image: linear-gradient(
    90deg,
    #000,
    transparent 24%,
    transparent 76%,
    #000
  );
}

.drama-banner__inner {
  position: relative;
  display: flex;
  align-items: center;
  gap: 17px;
  width: 100%;
  max-width: 1360px;
  height: 100%;
  margin: 0 auto;
  padding: 0 30px;
}

.drama-banner__brand {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  color: #1f5ebd;
  font-size: 14px;
  font-weight: 750;
  letter-spacing: -0.015em;
}

.drama-banner__brand svg {
  width: 17px;
  height: 17px;
  fill: #3385f3;
  filter: drop-shadow(0 3px 5px rgba(51, 133, 243, 0.2));
}

.drama-banner__brand strong {
  color: #0f72db;
  font-weight: 820;
}

.drama-banner__divider {
  flex: 0 0 1px;
  width: 1px;
  height: 20px;
  background: rgba(44, 93, 161, 0.18);
}

.drama-banner__promotion {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.drama-banner__promotion > strong {
  overflow: hidden;
  color: #16233c;
  font-size: 15px;
  font-weight: 780;
  letter-spacing: -0.01em;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drama-banner__lead {
  display: inline-block;
  flex: 0 0 auto;
  color: #2a68b7;
  font-size: 12px;
  font-weight: 680;
  letter-spacing: -0.005em;
  line-height: 1.25;
}

.drama-banner__action {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  padding: 9px 14px;
  border: 1px solid #1f70e4;
  border-radius: 9px;
  color: #fff;
  background: #2478ed;
  box-shadow:
    0 5px 14px rgba(37, 111, 218, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.24);
  font-size: 12px;
  font-weight: 720;
  line-height: 1;
  text-decoration: none;
  transition:
    transform 180ms ease,
    background-color 180ms ease,
    box-shadow 180ms ease;
}

.drama-banner__action svg {
  width: 15px;
  height: 15px;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 180ms ease;
}

.drama-banner__action:hover {
  color: #fff;
  background: #1268dd;
  box-shadow: 0 8px 18px rgba(37, 111, 218, 0.26);
  transform: translateY(-1px);
}

.drama-banner__action:hover svg {
  transform: translateX(2px);
}

.drama-banner__action:focus-visible,
.drama-banner__close:focus-visible {
  outline: 2px solid #2185ff;
  outline-offset: 2px;
}

.drama-banner__close {
  display: grid;
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 9px;
  color: #69768b;
  background: transparent;
  cursor: pointer;
  transition:
    color 180ms ease,
    background-color 180ms ease;
}

.drama-banner__close:hover {
  color: #18253d;
  background: rgba(46, 104, 184, 0.09);
}

.drama-banner__close svg {
  width: 17px;
  height: 17px;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

:global(.dark) .drama-banner {
  color: #e8f1ff;
  background:
    radial-gradient(
      circle at 14% -80%,
      rgba(45, 136, 255, 0.22),
      transparent 45%
    ),
    radial-gradient(
      circle at 88% 180%,
      rgba(255, 185, 82, 0.1),
      transparent 32%
    ),
    rgba(17, 25, 39, 0.96);
  border-bottom-color: rgba(113, 164, 237, 0.18);
}

:global(.dark) .drama-banner__brand {
  color: #b7d5ff;
}

:global(.dark) .drama-banner__brand strong {
  color: #62a8ff;
}

:global(.dark) .drama-banner__divider {
  background: rgba(177, 207, 248, 0.18);
}

:global(.dark) .drama-banner__promotion > strong {
  color: #f4f8ff;
}

:global(.dark) .drama-banner__lead {
  color: #91bdff;
}

:global(.dark) .drama-banner__close {
  color: #a6b4c8;
}

:global(.dark) .drama-banner__close:hover {
  color: #fff;
  background: rgba(143, 181, 235, 0.12);
}

@media (max-width: 760px) {
  .drama-banner__inner {
    gap: 11px;
    padding: 0 14px;
  }

  .drama-banner__divider {
    display: none;
  }

  .drama-banner__promotion {
    gap: 9px;
  }

  .drama-banner__promotion > strong {
    font-size: 13px;
  }
}

@media (max-width: 640px) {
  .drama-banner__inner {
    gap: 8px;
    padding: 0 9px 0 12px;
  }

  .drama-banner__brand {
    gap: 5px;
    font-size: 11px;
  }

  .drama-banner__brand svg {
    width: 14px;
    height: 14px;
  }

  .drama-banner__promotion {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }

  .drama-banner__lead {
    font-size: 9.5px;
  }

  .drama-banner__promotion > strong {
    display: block;
    width: 100%;
    font-size: 11.5px;
  }

  .drama-banner__action {
    margin-left: 0;
    padding: 8px;
  }

  .drama-banner__action span {
    display: none;
  }

  .drama-banner__close {
    flex-basis: 26px;
    width: 26px;
    height: 26px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .drama-banner__action,
  .drama-banner__action svg,
  .drama-banner__close {
    transition: none;
  }
}
</style>
