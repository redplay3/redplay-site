"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, ImagePlus, Plus, Save, Send, Trash2, Upload, Video } from "lucide-react";
import { ArticleBlockRenderer } from "@/components/article-block-renderer";
import { articleCategories, articleEditions, buildArticlePath } from "@/lib/articles/catalog";
import type { ArticleAudience, ArticleBlock, ArticleCategory, ArticleEdition, ArticleSection } from "@/lib/articles/types";
import { articleSeoTitle, categorySeo, editionSeo } from "@/lib/seo";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";

type EditorArticle = {
  id?: string;
  title: string;
  description: string;
  label: string;
  edition: ArticleEdition;
  category: ArticleCategory;
  slug: string;
  status?: "draft" | "scheduled" | "published";
  cover?: { src?: string; alt?: string };
  tags?: string[];
  content?: ArticleSection[];
  video_url?: string | null;
  published_at?: string | null;
  seo?: { title?: string; description?: string; keywords?: string[] };
};

const newId = () => typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

const blockNames: Record<ArticleBlock["type"], string> = {
  paragraph: "Текст", heading: "Заголовок", list: "Список", facts: "Цифры", note: "Плашка",
  warning: "Предупреждение", cards: "Карточки", "audience-cards": "Карточки версий",
  checklist: "Чек-лист", "cta-cards": "Карточки-ссылки", table: "Таблица", flow: "Маршрут",
  image: "Изображение", disclosure: "Выпадающий блок", opinion: "Мнение Они",
  video: "Видео", "video-playlist": "Видеоподборка", telegram: "Telegram",
};

function makeBlock(type: ArticleBlock["type"]): ArticleBlock {
  const id = newId();
  switch (type) {
    case "paragraph": return { id, type, text: "Новый абзац" };
    case "heading": return { id, type, text: "Название подраздела", level: 3 };
    case "list": return { id, type, items: ["Первый пункт", "Второй пункт"] };
    case "facts": return { id, type, items: [{ value: "120+", label: "уровень входа" }, { value: "3", label: "ключевых изменения" }] };
    case "note": return { id, type, title: "Важно", text: "Дополнительное пояснение для читателя.", icon: "alert" };
    case "warning": return { id, type, title: "Обрати внимание", text: "Важное предупреждение или ограничение." };
    case "cards": return { id, type, items: [{ title: "Ключевое изменение", text: "Коротко объясни его влияние.", icon: "sparkles" }] };
    case "audience-cards": return { id, type, items: [
      { scope: "all", title: "Что важно всем", text: "Короткая рекомендация для всех игроков." },
      { scope: "essence", title: "Что важно в Essence", text: "Рекомендация только для Essence." },
      { scope: "special-project", title: "Что важно в Special", text: "Рекомендация только для Special Project." },
    ] };
    case "checklist": return { id, type, items: [{ scope: "all", title: "Первый шаг", text: "Что именно нужно сделать и зачем." }] };
    case "cta-cards": return { id, type, items: [{ scope: "essence", title: "Lineage 2 Essence", text: "Бонус для нового старта.", action: "Получить бонус", url: "https://" }] };
    case "table": return { id, type, columns: ["Параметр", "Значение"], rows: [["Уровень", "120+"]] };
    case "flow": return { id, type, items: [{ title: "Первый этап", subtitle: "Начало" }, { title: "Второй этап", subtitle: "Финал" }] };
    case "image": return { id, type, src: "", alt: "", caption: "" };
    case "disclosure": return { id, type, title: "Показать полный список", items: ["Первый пункт"] };
    case "opinion": return { id, type, text: "Редакционный вывод RedPlay.", label: "Мнение RedPlay" };
    case "video": return { id, type, title: "Видеоразбор", text: "Главные изменения и выводы в видео.", url: "", source: "youtube" };
    case "video-playlist": return { id, type, title: "Видео классов", text: "Переключай ролики по названию класса.", items: [{ title: "Первое видео", url: "", text: "" }] };
    case "telegram": return { id, type, title: "Следи за обновлениями", text: "Финальные данные и обсуждение в Telegram.", action: "Получить уведомление" };
  }
}

function slugify(value: string) {
  const map: Record<string, string> = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
  return value.toLowerCase().split("").map((char) => map[char] ?? char).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
}

function pairs(value: string) {
  return value.split("\n").filter(Boolean).map((line) => { const [first, ...rest] = line.split("|"); return [first.trim(), rest.join("|").trim()]; });
}

const audienceLabels: Record<ArticleAudience, string> = { all: "Общий", essence: "Essence", "special-project": "Special" };

function audienceValue(value: string): ArticleAudience {
  const normalized = value.trim().toLowerCase();
  if (normalized === "essence" || normalized === "только essence") return "essence";
  if (normalized === "special" || normalized === "special project" || normalized === "только special") return "special-project";
  return "all";
}

function scopedRows(value: string) {
  return value.split("\n").filter(Boolean).map((line) => {
    const [scope, title, ...text] = line.split("|");
    return { scope: audienceValue(scope), title: title?.trim() || "Без заголовка", text: text.join("|").trim() };
  });
}

function ctaRows(value: string) {
  return value.split("\n").filter(Boolean).map((line) => {
    const [scope, title, text, action, ...url] = line.split("|");
    return {
      scope: audienceValue(scope),
      title: title?.trim() || "Без заголовка",
      text: text?.trim() || "",
      action: action?.trim() || "Открыть",
      url: url.join("|").trim(),
    };
  });
}

async function storageError(response: Response) {
  const fallback = `Ошибка загрузки (${response.status}).`;
  try {
    const raw = await response.text();
    if (!raw) return fallback;
    try {
      const body = JSON.parse(raw) as { message?: string; error?: string };
      return body.message || body.error || raw;
    } catch {
      return raw;
    }
  } catch {
    return fallback;
  }
}

async function assertBrowserPlayableVideo(file: File) {
  if (file.size > 50 * 1024 * 1024) throw new Error("Видео больше 50 МБ. Сожми файл перед загрузкой.");

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Не удалось прочитать видеодорожку. Перекодируй файл в H.264/AVC.")), 8000);
      const finish = (cause?: Error) => {
        window.clearTimeout(timeout);
        cause ? reject(cause) : resolve();
      };

      video.onerror = () => finish(new Error("Браузер не поддерживает кодек этого видео. Используй MP4 с H.264/AVC или WebM с VP9."));
      video.onloadedmetadata = () => window.setTimeout(() => {
        if (video.videoWidth > 0 && video.videoHeight > 0) finish();
        else finish(new Error("В MP4 обнаружен неподдерживаемый видеокодек (обычно H.265/HEVC). Перекодируй ролик в H.264/AVC."));
      }, 150);
      video.src = objectUrl;
      video.load();
    });
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function BlockFields({ block, onChange, uploadMedia, uploadProgress }: { block: ArticleBlock; onChange: (next: ArticleBlock) => void; uploadMedia: (file: File, kind: "image" | "video") => Promise<string>; uploadProgress: number | null }) {
  const input = (value: string, change: (value: string) => void, placeholder = "") => <input value={value} placeholder={placeholder} onChange={(event) => change(event.target.value)}/>;
  const area = (value: string, change: (value: string) => void, placeholder = "") => <textarea rows={4} value={value} placeholder={placeholder} onChange={(event) => change(event.target.value)}/>;
  switch (block.type) {
    case "paragraph": return <label className="admin-field"><span>Текст</span>{area(block.text, (text) => onChange({ ...block, text }))}</label>;
    case "heading": return <><label className="admin-field"><span>Заголовок</span>{input(block.text, (text) => onChange({ ...block, text }))}</label><label className="admin-field"><span>Подпись над заголовком</span>{input(block.kicker || "", (kicker) => onChange({ ...block, kicker }))}</label><label className="admin-field"><span>Размер</span><select value={block.level} onChange={(event) => onChange({ ...block, level: Number(event.target.value) as 2 | 3 })}><option value="2">Крупный H2</option><option value="3">Подзаголовок H3</option></select></label></>;
    case "list": return <><label className="admin-field"><span>Один пункт на строку</span>{area(block.items.join("\n"), (value) => onChange({ ...block, items: value.split("\n") }))}</label><label className="admin-field"><span>Вид списка</span><select value={block.ordered ? "ordered" : "bullets"} onChange={(event) => onChange({ ...block, ordered: event.target.value === "ordered" })}><option value="bullets">Маркеры</option><option value="ordered">Нумерация</option></select></label></>;
    case "facts": return <label className="admin-field"><span>Значение | подпись, одна карточка на строку</span>{area(block.items.map((item) => `${item.value} | ${item.label}`).join("\n"), (value) => onChange({ ...block, items: pairs(value).map(([value, label]) => ({ value, label })) }))}</label>;
    case "note": return <><label className="admin-field"><span>Заголовок</span>{input(block.title, (title) => onChange({ ...block, title }))}</label><label className="admin-field"><span>Пояснение</span>{area(block.text, (text) => onChange({ ...block, text }))}</label></>;
    case "warning": return <><label className="admin-field"><span>Заголовок</span>{input(block.title, (title) => onChange({ ...block, title }))}</label><label className="admin-field"><span>Предупреждение</span>{area(block.text, (text) => onChange({ ...block, text }))}</label></>;
    case "cards": return <label className="admin-field"><span>Заголовок | описание, одна карточка на строку</span>{area(block.items.map((item) => `${item.title} | ${item.text}`).join("\n"), (value) => onChange({ ...block, items: pairs(value).map(([title, text]) => ({ title, text, icon: "sparkles" as const })) }))}</label>;
    case "audience-cards": return <label className="admin-field"><span>Версия | заголовок | описание, одна карточка на строку</span>{area(block.items.map((item) => `${audienceLabels[item.scope]} | ${item.title} | ${item.text}`).join("\n"), (value) => onChange({ ...block, items: scopedRows(value) }))}<small>Версия: Общий, Essence или Special. Метка появится внутри карточки.</small></label>;
    case "checklist": return <label className="admin-field"><span>Версия | действие | пояснение, один шаг на строку</span>{area(block.items.map((item) => `${audienceLabels[item.scope]} | ${item.title} | ${item.text}`).join("\n"), (value) => onChange({ ...block, items: scopedRows(value) }))}<small>Шаги автоматически нумеруются и фильтруются по выбранной версии.</small></label>;
    case "cta-cards": return <label className="admin-field"><span>Версия | заголовок | описание | кнопка | URL</span>{area(block.items.map((item) => `${audienceLabels[item.scope]} | ${item.title} | ${item.text} | ${item.action} | ${item.url}`).join("\n"), (value) => onChange({ ...block, items: ctaRows(value) }))}<small>Карточка и кнопка будут вести по указанной ссылке.</small></label>;
    case "table": return <><label className="admin-field"><span>Колонки через |</span>{input(block.columns.join(" | "), (value) => onChange({ ...block, columns: value.split("|").map((item) => item.trim()) }))}</label><label className="admin-field"><span>Каждая строка отдельно, ячейки через |</span>{area(block.rows.map((row) => row.join(" | ")).join("\n"), (value) => onChange({ ...block, rows: value.split("\n").map((row) => row.split("|").map((cell) => cell.trim())) }))}</label></>;
    case "flow": return <label className="admin-field"><span>Этап | подпись, один этап на строку</span>{area(block.items.map((item) => `${item.title} | ${item.subtitle || ""}`).join("\n"), (value) => onChange({ ...block, items: pairs(value).map(([title, subtitle]) => ({ title, subtitle })) }))}</label>;
    case "image": return <><label className="admin-field"><span>Адрес изображения</span>{input(block.src, (src) => onChange({ ...block, src }))}</label><label className="admin-field"><span>Описание изображения</span>{input(block.alt, (alt) => onChange({ ...block, alt }))}</label><label className="admin-field"><span>Подпись под изображением</span>{input(block.caption || "", (caption) => onChange({ ...block, caption }))}</label><label className="admin-secondary"><ImagePlus size={15}/> Загрузить файл<input hidden type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) onChange({ ...block, src: await uploadMedia(file, "image"), alt: block.alt || file.name }); }}/></label></>;
    case "disclosure": return <><label className="admin-field"><span>Название</span>{input(block.title, (title) => onChange({ ...block, title }))}</label><label className="admin-field"><span>Один пункт на строку</span>{area(block.items.join("\n"), (value) => onChange({ ...block, items: value.split("\n") }))}</label></>;
    case "opinion": return <><label className="admin-field"><span>Подпись</span>{input(block.label || "", (label) => onChange({ ...block, label }))}</label><label className="admin-field"><span>Мнение</span>{area(block.text, (text) => onChange({ ...block, text }))}</label></>;
    case "video": {
      const source = block.source || "youtube";
      return <>
        <label className="admin-field"><span>Источник видео</span><select value={source} onChange={(event) => onChange({ ...block, source: event.target.value as "youtube" | "file" })}><option value="youtube">YouTube</option><option value="file">Загрузить видеофайл</option></select></label>
        <label className="admin-field"><span>Заголовок</span>{input(block.title, (title) => onChange({ ...block, title }))}</label>
        <label className="admin-field"><span>Описание</span>{area(block.text, (text) => onChange({ ...block, text }))}</label>
        {source === "youtube" ? <label className="admin-field"><span>Ссылка на ролик YouTube</span>{input(block.url, (url) => onChange({ ...block, url }), "https://youtu.be/...")}<small>Подойдут обычные ссылки, Shorts, Live и youtu.be.</small></label> : <>
          <label className="admin-field"><span>Адрес загруженного видео</span>{input(block.url, (url) => onChange({ ...block, url }), "Появится после загрузки")}</label>
          <label className={`admin-secondary admin-upload-video${uploadProgress !== null ? " is-uploading" : ""}`}><Upload size={15}/> {uploadProgress !== null ? `Загрузка ${uploadProgress}%` : "Загрузить MP4 или WebM"}<input hidden disabled={uploadProgress !== null} type="file" accept="video/mp4,video/webm,video/ogg" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { onChange({ ...block, url: await uploadMedia(file, "video"), source: "file" }); } catch { /* uploadMedia already shows a detailed error */ } finally { event.target.value = ""; } }}/></label>
          <small>Для стабильного воспроизведения: MP4 с H.264/AVC или WebM с VP9, до 50 МБ. H.265/HEVC не поддерживается большинством браузеров.</small>
        </>}
        <label className="admin-field"><span>Подпись под видео</span>{input(block.caption || "", (caption) => onChange({ ...block, caption }), "Необязательно")}</label>
      </>;
    }
    case "video-playlist": return <>
      <label className="admin-field"><span>Заголовок подборки</span>{input(block.title, (title) => onChange({ ...block, title }))}</label>
      <label className="admin-field"><span>Описание</span>{area(block.text || "", (text) => onChange({ ...block, text }))}</label>
      <label className="admin-field"><span>Название | ссылка YouTube | пояснение, одно видео на строку</span>{area(block.items.map((item) => `${item.title} | ${item.url} | ${item.text || ""}`).join("\n"), (value) => onChange({ ...block, items: value.split("\n").map((row) => row.split("|").map((part) => part.trim())).filter(([title, url]) => title || url).map(([title, url, ...rest]) => ({ title, url, text: rest.join(" | ") })) }))}<small>На странице появится один плеер и кнопки-переключатели. Поддерживаются обычные ссылки YouTube, Shorts, Live и youtu.be.</small></label>
    </>;
    case "telegram": return <><label className="admin-field"><span>Заголовок</span>{input(block.title, (title) => onChange({ ...block, title }))}</label><label className="admin-field"><span>Описание</span>{area(block.text, (text) => onChange({ ...block, text }))}</label></>;
  }
}

export function ArticleEditor({ initial }: { initial?: EditorArticle }) {
  const router = useRouter();
  const normalizedInitial = initial ? {
    ...initial,
    edition: initial.edition === "special-project" ? "essence" as const : initial.edition,
    seo: initial.seo?.title === initial.title ? { ...initial.seo, title: "" } : initial.seo,
  } : undefined;
  const [article, setArticle] = useState<EditorArticle>(normalizedInitial || { title: "", description: "", label: "Новый материал", edition: "main", category: "news", slug: "", cover: {}, tags: [], content: [{ id: "summary", label: "Коротко о главном", blocks: [makeBlock("paragraph")] }] });
  const [targets, setTargets] = useState<Array<"essence" | "special-project">>(() => {
    if (initial?.edition === "special-project") return ["special-project"];
    const saved = initial?.tags?.filter((tag) => tag === "Essence" || tag === "Special Project") || [];
    return saved.length ? saved.map((tag) => tag === "Essence" ? "essence" : "special-project") : ["essence", "special-project"];
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const sections = article.content || [];
  const path = useMemo(() => article.slug ? buildArticlePath(article.edition, article.category, article.slug) : "Адрес появится после заголовка", [article]);
  const contentTags = (article.tags || []).filter((tag) => tag !== "Essence" && tag !== "Special Project");
  const suggestedKeywords = useMemo(() => [...new Set([...categorySeo[article.category].keywords, ...editionSeo[article.edition].keywords])], [article.category, article.edition]);
  const seoTitlePreview = article.seo?.title?.trim()
    ? (/redplay/i.test(article.seo.title) ? article.seo.title : articleSeoTitle(article.seo.title, article.edition))
    : articleSeoTitle(article.title || "Название материала", article.edition);
  const seoDescriptionPreview = article.seo?.description?.trim() || article.description;

  const setSections = (content: ArticleSection[]) => setArticle((current) => ({ ...current, content }));
  const updateBlock = (sectionIndex: number, blockIndex: number, block: ArticleBlock) => setSections(sections.map((section, index) => index === sectionIndex ? { ...section, blocks: section.blocks.map((item, childIndex) => childIndex === blockIndex ? block : item) } : section));
  const moveBlock = (sectionIndex: number, blockIndex: number, direction: -1 | 1) => {
    const next = sections.map((section) => ({ ...section, blocks: [...section.blocks] }));
    const target = blockIndex + direction;
    if (target < 0 || target >= next[sectionIndex].blocks.length) return;
    [next[sectionIndex].blocks[blockIndex], next[sectionIndex].blocks[target]] = [next[sectionIndex].blocks[target], next[sectionIndex].blocks[blockIndex]];
    setSections(next);
  };
  const uploadMedia = async (file: File, kind: "image" | "video") => {
    if (kind === "video" && !["video/mp4", "video/webm", "video/ogg"].includes(file.type)) {
      throw new Error("Поддерживаются видео MP4, WebM и OGG.");
    }
    if (kind === "video") {
      setMessage(`Проверяю совместимость видео: ${file.name}`);
      try {
        await assertBrowserPlayableVideo(file);
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : "Видео не поддерживается браузером.");
        throw cause;
      }
    }
    setMessage(kind === "video" ? `Подготовка видео: ${file.name}` : "Загружаю изображение…");
    const supabase = createClient();
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
    const filePath = `${new Date().getFullYear()}/${kind}/${newId()}-${safeName}`;
    try {
      if (kind === "video") {
        const config = getSupabaseConfig();
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!config || !sessionData.session?.access_token) throw new Error("Сессия редактора истекла. Обнови страницу и войди снова.");

        const encodeMetadata = (value: string) => btoa(Array.from(new TextEncoder().encode(value), (byte) => String.fromCharCode(byte)).join(""));
        const projectUrl = new URL(config.url);
        const storageHost = projectUrl.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
        const endpoint = `${projectUrl.protocol}//${storageHost}/storage/v1/upload/resumable`;
        const metadata = [
          ["bucketName", "article-media"],
          ["objectName", filePath],
          ["contentType", file.type],
          ["cacheControl", "31536000"],
        ].map(([key, value]) => `${key} ${encodeMetadata(value)}`).join(",");
        const authHeaders = { Authorization: `Bearer ${sessionData.session.access_token}`, apikey: config.key };
        setUploadProgress(0);
        const created = await fetch(endpoint, { method: "POST", headers: { ...authHeaders, "Tus-Resumable": "1.0.0", "Upload-Length": String(file.size), "Upload-Metadata": metadata, "x-upsert": "false" } });
        if (!created.ok) throw new Error(await storageError(created));
        const location = created.headers.get("Location");
        if (!location) throw new Error("Хранилище не вернуло адрес загрузки.");
        const uploadUrl = new URL(location, endpoint).toString();
        const chunkSize = 6 * 1024 * 1024;
        let offset = 0;

        while (offset < file.size) {
          const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
          let response: Response | null = null;
          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              response = await fetch(uploadUrl, { method: "PATCH", headers: { ...authHeaders, "Tus-Resumable": "1.0.0", "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" }, body: chunk });
              if (response.ok) break;
              if (response.status < 500 && response.status !== 429) throw new Error(await storageError(response));
            } catch (cause) {
              if (attempt === 2 || (cause instanceof Error && !/fetch|network|load/i.test(cause.message))) throw cause;
            }
            await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
          }
          if (!response?.ok) throw new Error(response ? await storageError(response) : "Соединение с хранилищем прервано.");
          offset = Number(response.headers.get("Upload-Offset")) || offset + chunk.size;
          const percent = Math.min(100, Math.round((offset / file.size) * 100));
          setUploadProgress(percent);
          setMessage(`Загрузка видео: ${percent}% · не закрывай страницу`);
        }
      } else {
        const { error } = await supabase.storage.from("article-media").upload(filePath, file, { upsert: false, contentType: file.type, cacheControl: "31536000" });
        if (error) throw error;
      }
      setMessage(kind === "video" ? "Видео загружено. Не забудь сохранить публикацию." : "Изображение загружено.");
      return supabase.storage.from("article-media").getPublicUrl(filePath).data.publicUrl;
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Не удалось загрузить файл.");
      throw cause;
    } finally {
      if (kind === "video") setUploadProgress(null);
    }
  };
  const save = async (status: "draft" | "published") => {
    if (!article.title.trim() || !article.slug.trim()) return setMessage("Заполни название и адрес материала.");
    if (article.edition === "essence" && !targets.length) return setMessage("Выбери хотя бы один тип серверов: Essence или Special Project.");
    setSaving(true); setMessage("");
    try {
      const supabase = createClient();
      const ordinaryTags = (article.tags || []).filter((tag) => tag !== "Essence" && tag !== "Special Project");
      const audienceTags = article.edition === "essence" ? targets.map((target) => target === "essence" ? "Essence" : "Special Project") : [];
      const customSeoTitle = article.seo?.title?.trim();
      const finalSeoTitle = customSeoTitle ? (/redplay/i.test(customSeoTitle) ? customSeoTitle : articleSeoTitle(customSeoTitle, article.edition)) : articleSeoTitle(article.title, article.edition);
      const payload = { game: "lineage-2", edition: article.edition, category: article.category, slug: article.slug, status, title: article.title, description: article.description, label: article.label, cover: article.cover || {}, tags: [...ordinaryTags, ...audienceTags], highlights: [], content: sections, seo: { title: finalSeoTitle, description: article.seo?.description?.trim() || article.description, keywords: ordinaryTags }, video_url: article.video_url || null, published_at: status === "published" ? article.published_at || new Date().toISOString() : null };
      const query = article.id ? supabase.from("articles").update(payload).eq("id", article.id) : supabase.from("articles").insert(payload);
      const { data, error } = await query.select("id").single();
      if (error) throw error;
      setMessage(status === "published" ? "Материал опубликован." : "Черновик сохранён.");
      if (!article.id) router.replace(`/redplay-admin/articles/${data.id}`);
      router.refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Не удалось сохранить материал."); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!article.id) return;
    const confirmed = window.confirm(`Удалить публикацию «${article.title}»? Это действие нельзя отменить.`);
    if (!confirmed) return;
    setSaving(true); setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("articles").delete().eq("id", article.id);
      if (error) throw error;
      router.replace("/redplay-admin");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Не удалось удалить публикацию.");
      setSaving(false);
    }
  };

  return <div className="editor-layout"><div><div className="editor-panel"><div className="editor-meta">
    <label className="admin-field wide"><span>Название публикации</span><input value={article.title} onChange={(event) => setArticle({ ...article, title: event.target.value, slug: article.slug || slugify(event.target.value) })}/></label>
    <label className="admin-field wide"><span>Краткое описание</span><textarea rows={3} value={article.description} onChange={(event) => setArticle({ ...article, description: event.target.value })}/></label>
    <label className="admin-field"><span>Версия игры</span><select value={article.edition} onChange={(event) => setArticle({ ...article, edition: event.target.value as ArticleEdition })}>{articleEditions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label className="admin-field"><span>Категория</span><select value={article.category} onChange={(event) => setArticle({ ...article, category: event.target.value as ArticleCategory })}>{articleCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    {article.edition === "essence" && <div className="admin-field wide"><span>Материал относится к серверам</span><div className="editor-targets"><label><input type="checkbox" checked={targets.includes("essence")} onChange={(event) => setTargets(event.target.checked ? [...new Set([...targets, "essence" as const])] : targets.filter((item) => item !== "essence"))}/> Essence</label><label><input type="checkbox" checked={targets.includes("special-project")} onChange={(event) => setTargets(event.target.checked ? [...new Set([...targets, "special-project" as const])] : targets.filter((item) => item !== "special-project"))}/> Special Project</label></div></div>}
    <label className="admin-field wide"><span>Адрес страницы</span><input value={article.slug} onChange={(event) => setArticle({ ...article, slug: slugify(event.target.value) })}/><small>{path}</small></label>
    <label className="admin-field wide"><span>Обложка – адрес или загруженный файл</span><input value={article.cover?.src || ""} onChange={(event) => setArticle({ ...article, cover: { ...article.cover, src: event.target.value } })}/><label className="admin-secondary"><ImagePlus size={15}/> Загрузить обложку<input hidden type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setArticle({ ...article, cover: { src: await uploadMedia(file, "image"), alt: article.title } }); }}/></label></label>
    <div className="editor-seo wide">
      <div className="editor-seo-head"><div><strong>SEO и поиск</strong><span>Как публикация будет называться и описываться в поиске</span></div><span className={seoTitlePreview.length > 72 ? "is-long" : ""}>{seoTitlePreview.length} знаков</span></div>
      <label className="admin-field wide"><span>SEO-заголовок</span><input value={article.seo?.title || ""} placeholder={articleSeoTitle(article.title || "Название материала", article.edition)} onChange={(event) => setArticle({ ...article, seo: { ...article.seo, title: event.target.value } })}/><small>Можно оставить пустым – RedPlay сформирует заголовок автоматически.</small></label>
      <label className="admin-field wide"><span>Описание для поиска и социальных сетей</span><textarea rows={3} value={article.seo?.description || ""} placeholder={article.description || "Кратко объясни, что узнает читатель."} onChange={(event) => setArticle({ ...article, seo: { ...article.seo, description: event.target.value } })}/><small className={seoDescriptionPreview.length > 170 ? "is-long" : ""}>{seoDescriptionPreview.length} знаков · оптимально около 120–170</small></label>
      <label className="admin-field wide"><span>Ключевые темы и теги через запятую</span><input value={contentTags.join(", ")} placeholder="например: Диверсант, PvE, фарм адены" onChange={(event) => setArticle({ ...article, tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })}/></label>
      <div className="editor-keywords"><span>Подходящие запросы:</span>{suggestedKeywords.map((keyword) => <button type="button" key={keyword} onClick={() => !contentTags.includes(keyword) && setArticle({ ...article, tags: [...contentTags, keyword] })}>+ {keyword}</button>)}</div>
      <div className="editor-serp"><small>redplay.stream › {article.edition} › {article.category}</small><strong>{seoTitlePreview}</strong><p>{seoDescriptionPreview || "Добавь краткое описание материала – оно появится здесь."}</p></div>
    </div>
  </div></div>
  {sections.map((section, sectionIndex) => <div className="editor-section" key={section.id}><div className="editor-section-head"><input value={section.label} onChange={(event) => setSections(sections.map((item, index) => index === sectionIndex ? { ...item, label: event.target.value, id: slugify(event.target.value) || item.id } : item))}/><button className="editor-icon-button" onClick={() => setSections(sections.filter((_, index) => index !== sectionIndex))}><Trash2 size={15}/></button></div>
    {section.blocks.map((block, blockIndex) => <div className="editor-block" key={block.id}><div className="editor-block-tools"><span>{block.type === "video" && <Video size={13}/>} {blockNames[block.type]}</span><span className="editor-block-actions">{article.edition === "essence" && <select className={`editor-scope ${block.scope || "all"}`} value={block.scope || "all"} onChange={(event) => updateBlock(sectionIndex, blockIndex, { ...block, scope: event.target.value as ArticleAudience })}><option value="all">Общий</option><option value="essence">Только Essence</option><option value="special-project">Только Special</option></select>}<button className="editor-icon-button" onClick={() => moveBlock(sectionIndex, blockIndex, -1)}><ArrowUp size={14}/></button><button className="editor-icon-button" onClick={() => moveBlock(sectionIndex, blockIndex, 1)}><ArrowDown size={14}/></button><button className="editor-icon-button" onClick={() => setSections(sections.map((item, index) => index === sectionIndex ? { ...item, blocks: item.blocks.filter((_, childIndex) => childIndex !== blockIndex) } : item))}><Trash2 size={14}/></button></span></div><BlockFields block={block} onChange={(next) => updateBlock(sectionIndex, blockIndex, next)} uploadMedia={uploadMedia} uploadProgress={uploadProgress}/></div>)}
    <div className="block-library">{(Object.keys(blockNames) as ArticleBlock["type"][]).map((type) => <button key={type} onClick={() => setSections(sections.map((item, index) => index === sectionIndex ? { ...item, blocks: [...item.blocks, makeBlock(type)] } : item))}><Plus size={12}/> {blockNames[type]}</button>)}</div>
  </div>)}
  <div className="editor-actions"><button className="admin-secondary" onClick={() => setSections([...sections, { id: `section-${sections.length + 1}`, label: `Новый раздел ${sections.length + 1}`, blocks: [makeBlock("paragraph")] }])}><Plus size={15}/> Добавить раздел</button><button className="admin-secondary" disabled={saving || uploadProgress !== null} onClick={() => save("draft")}><Save size={15}/> Сохранить черновик</button><button className="admin-primary" disabled={saving || uploadProgress !== null} onClick={() => save("published")}><Send size={15}/> Опубликовать</button>{article.id && <button className="admin-danger" disabled={saving || uploadProgress !== null} onClick={remove}><Trash2 size={15}/> Удалить публикацию</button>}{message && <span className="admin-saving">{message}</span>}</div></div>
  {message && <div className={`admin-toast${uploadProgress !== null ? " is-progress" : ""}`}>{uploadProgress !== null && <span style={{ width: `${uploadProgress}%` }}/>}<p>{message}</p></div>}
  <aside className="editor-panel editor-preview"><div className="editor-preview-head"><strong><Eye size={15}/> Предпросмотр</strong><span className="admin-status">{article.status || "draft"}</span></div><div className="article-body">{sections.map((section) => <section id={section.id} key={section.id}><ArticleBlockRenderer blocks={section.blocks}/></section>)}</div></aside></div>;
}
