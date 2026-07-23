import Theme from "vitepress/theme";
import "./style/var.css";
import "./style/global.css";
import type { EnhanceAppContext } from "vitepress";
import { createI18n } from "vue-i18n";
import Layout from "./Layout.vue";

const i18n = createI18n({
  legacy: false,
  locale: "zh",
  messages: {
    en: {
      slogan: "Easy to use, fast download",
      articles: "Articles",
      help: "Help",
      blog: "Blog",
      privacy: "Privacy Policy",
      banner: {
        label: "MediaGo Drama announcement",
        badge: "Open source",
        title: "Create viral comic dramas in one click",
        action: "Start creating",
        actionLabel: "Explore MediaGo Drama in a new tab",
        close: "Close MediaGo Drama announcement",
      },
    },
    jp: {
      slogan: "使いやすく、ダウンロードも速い",
      articles: "記事",
      help: "ヘルプ",
      blog: "ブログ",
      privacy: "プライバシーポリシー",
      banner: {
        label: "MediaGo Drama のお知らせ",
        badge: "オープンソース",
        title: "ワンクリックで話題のマンガ動画を制作",
        action: "今すぐ制作",
        actionLabel: "MediaGo Drama を新しいタブで見る",
        close: "MediaGo Drama のお知らせを閉じる",
      },
    },
    zh: {
      slogan: "简单易用，快速下载",
      articles: "文章",
      help: "帮助",
      blog: "博客",
      privacy: "隐私政策",
      banner: {
        label: "MediaGo Drama 产品公告",
        badge: "开源漫剧 Agent",
        title: "一键产出爆款",
        action: "立即创作",
        actionLabel: "在新标签页了解 MediaGo Drama",
        close: "关闭 MediaGo Drama 公告",
      },
    },
    it: {
      slogan: "Facile da usare, download veloce",
      articles: "Articoli",
      help: "Aiuto",
      blog: "Blog",
      privacy: "Informativa sulla privacy",
      banner: {
        label: "Annuncio MediaGo Drama",
        badge: "Open source",
        title: "Crea comic drama virali con un clic",
        action: "Inizia a creare",
        actionLabel: "Scopri MediaGo Drama in una nuova scheda",
        close: "Chiudi l'annuncio di MediaGo Drama",
      },
    },
  },
});

export default {
  extends: Theme,
  Layout,
  enhanceApp({ app }: EnhanceAppContext) {
    app.use(i18n);
  },
};
