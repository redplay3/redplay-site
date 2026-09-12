"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, ImagePlus, Plus, Save, Send, Trash2 } from "lucide-react";
import { ArticleBlockRenderer } from "@/components/article-block-renderer";
import { articleCategories, articleEditions, buildArticlePath } from "@/lib/articles/catalog";
import type { ArticleBlock, ArticleCategory, ArticleEdition, ArticleSection } from "@/lib/articles/types";
import { createClient } from "@/lib/supabase/client";

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
};

const newId = () => typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

const blockNames: Record<ArticleBlock["type"], string> = {
  paragraph: "Текст", heading: "Заголовок", list: "Список", facts: "Цифры", note: "Плашка",
  warning: "Предупреждение", cards: "Карточки", table: "Таблица", flow: "Маршрут",
  image: "Изображение", disclosure: "Выпадающий блок", opinion: "Мнение Они",
  video: "YouTube", telegram: "Telegram",
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
    case "table": return { id, type, columns: ["Параметр", "Значение"], rows: [["Уровень", "120+"]] };
    case "flow": return { id, type, items: [{ title: "Первый этап", subtitle: "Начало" }, { title: "Второй этап", subtitle: "Финал" }] };
    case "image": return { id, type, src: "", alt: "", caption: "" };
    case "disclosure": return { id, type, title: "Показать полный список", items: ["Первый пункт"] };
    case "opinion": return { id, type, text: "Редакционный вывод RedPlay.", label: "Мнение RedPlay" };
    case "video": return { id, type, title: "Посмотри видеоразбор", text: "Главные изменения и выводы в видео.", url: "https://www.youtube.com/@iRedP", action: "Смотреть" };
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

function BlockFields({ block, onChange, uploadImage }: { block: ArticleBlock; onChange: (next: ArticleBlock) => void; uploadImage: (file: File) => Promise<string> }) {
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
    case "table": return <><label className="admin-field"><span>Колонки через |</span>{input(block.columns.join(" | "), (value) => onChange({ ...block, columns: value.split("|").map((item) => item.trim()) }))}</label><label className="admin-field"><span>Каждая строка отдельно, ячейки через |</span>{area(block.rows.map((row) => row.join(" | ")).join("\n"), (value) => onChange({ ...block, rows: value.split("\n").map((row) => row.split("|").map((cell) => cell.trim())) }))}</label></>;
    case "flow": return <label className="admin-field"><span>Этап | подпись, один этап на строку</span>{area(block.items.map((item) => `${item.title} | ${item.subtitle || ""}`).join("\n"), (value) => onChange({ ...block, items: pairs(value).map(([title, subtitle]) => ({ title, subtitle })) }))}</label>;
    case "image": return <><label className="admin-field"><span>Адрес изображения</span>{input(block.src, (src) => onChange({ ...block, src }))}</label><label className="admin-field"><span>Описание изображения</span>{input(block.alt, (alt) => onChange({ ...block, alt }))}</label><label className="admin-field"><span>Подпись под изображением</span>{input(block.caption || "", (caption) => onChange({ ...block, caption }))}</label><label className="admin-secondary"><ImagePlus size={15}/> Загрузить файл<input hidden type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) onChange({ ...block, src: await uploadImage(file), alt: block.alt || file.name }); }}/></label></>;
    case "disclosure": return <><label className="admin-field"><span>Название</span>{input(block.title, (title) => onChange({ ...block, title }))}</label><label className="admin-field"><span>Один пункт на строку</span>{area(block.items.join("\n"), (value) => onChange({ ...block, items: value.split("\n") }))}</label></>;
    case "opinion": return <><label className="admin-field"><span>Подпись</span>{input(block.label || "", (label) => onChange({ ...block, label }))}</label><label className="admin-field"><span>Мнение</span>{area(block.text, (text) => onChange({ ...block, text }))}</label></>;
    case "video": return <><label className="admin-field"><span>Заголовок</span>{input(block.title, (title) => onChange({ ...block, title }))}</label><label className="admin-field"><span>Описание</span>{area(block.text, (text) => onChange({ ...block, text }))}</label><label className="admin-field"><span>Ссылка YouTube</span>{input(block.url, (url) => onChange({ ...block, url }))}</label></>;
    case "telegram": return <><label className="admin-field"><span>Заголовок</span>{input(block.title, (title) => onChange({ ...block, title }))}</label><label className="admin-field"><span>Описание</span>{area(block.text, (text) => onChange({ ...block, text }))}</label></>;
  }
}

export function ArticleEditor({ initial }: { initial?: EditorArticle }) {
  const router = useRouter();
  const [article, setArticle] = useState<EditorArticle>(initial || { title: "", description: "", label: "Новый материал", edition: "main", category: "news", slug: "", cover: {}, tags: [], content: [{ id: "summary", label: "Коротко о главном", blocks: [makeBlock("paragraph")] }] });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const sections = article.content || [];
  const path = useMemo(() => article.slug ? buildArticlePath(article.edition, article.category, article.slug) : "Адрес появится после заголовка", [article]);

  const setSections = (content: ArticleSection[]) => setArticle((current) => ({ ...current, content }));
  const updateBlock = (sectionIndex: number, blockIndex: number, block: ArticleBlock) => setSections(sections.map((section, index) => index === sectionIndex ? { ...section, blocks: section.blocks.map((item, childIndex) => childIndex === blockIndex ? block : item) } : section));
  const moveBlock = (sectionIndex: number, blockIndex: number, direction: -1 | 1) => {
    const next = sections.map((section) => ({ ...section, blocks: [...section.blocks] }));
    const target = blockIndex + direction;
    if (target < 0 || target >= next[sectionIndex].blocks.length) return;
    [next[sectionIndex].blocks[blockIndex], next[sectionIndex].blocks[target]] = [next[sectionIndex].blocks[target], next[sectionIndex].blocks[blockIndex]];
    setSections(next);
  };
  const uploadImage = async (file: File) => {
    const supabase = createClient();
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
    const filePath = `${new Date().getFullYear()}/${newId()}-${safeName}`;
    const { error } = await supabase.storage.from("article-media").upload(filePath, file, { upsert: false });
    if (error) throw error;
    return supabase.storage.from("article-media").getPublicUrl(filePath).data.publicUrl;
  };
  const save = async (status: "draft" | "published") => {
    if (!article.title.trim() || !article.slug.trim()) return setMessage("Заполни название и адрес материала.");
    setSaving(true); setMessage("");
    try {
      const supabase = createClient();
      const payload = { game: "lineage-2", edition: article.edition, category: article.category, slug: article.slug, status, title: article.title, description: article.description, label: article.label, cover: article.cover || {}, tags: article.tags || [], highlights: [], content: sections, seo: { title: article.title, description: article.description }, video_url: article.video_url || null, published_at: status === "published" ? new Date().toISOString() : null };
      const query = article.id ? supabase.from("articles").update(payload).eq("id", article.id) : supabase.from("articles").insert(payload);
      const { data, error } = await query.select("id").single();
      if (error) throw error;
      setMessage(status === "published" ? "Материал опубликован." : "Черновик сохранён.");
      if (!article.id) router.replace(`/redplay-admin/articles/${data.id}`);
      router.refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Не удалось сохранить материал."); }
    finally { setSaving(false); }
  };

  return <div className="editor-layout"><div><div className="editor-panel"><div className="editor-meta">
    <label className="admin-field wide"><span>Название публикации</span><input value={article.title} onChange={(event) => setArticle({ ...article, title: event.target.value, slug: article.slug || slugify(event.target.value) })}/></label>
    <label className="admin-field wide"><span>Краткое описание</span><textarea rows={3} value={article.description} onChange={(event) => setArticle({ ...article, description: event.target.value })}/></label>
    <label className="admin-field"><span>Версия</span><select value={article.edition} onChange={(event) => setArticle({ ...article, edition: event.target.value as ArticleEdition })}>{articleEditions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label className="admin-field"><span>Категория</span><select value={article.category} onChange={(event) => setArticle({ ...article, category: event.target.value as ArticleCategory })}>{articleCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label className="admin-field wide"><span>Адрес страницы</span><input value={article.slug} onChange={(event) => setArticle({ ...article, slug: slugify(event.target.value) })}/><small>{path}</small></label>
    <label className="admin-field wide"><span>Обложка – адрес или загруженный файл</span><input value={article.cover?.src || ""} onChange={(event) => setArticle({ ...article, cover: { ...article.cover, src: event.target.value } })}/><label className="admin-secondary"><ImagePlus size={15}/> Загрузить обложку<input hidden type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setArticle({ ...article, cover: { src: await uploadImage(file), alt: article.title } }); }}/></label></label>
  </div></div>
  {sections.map((section, sectionIndex) => <div className="editor-section" key={section.id}><div className="editor-section-head"><input value={section.label} onChange={(event) => setSections(sections.map((item, index) => index === sectionIndex ? { ...item, label: event.target.value, id: slugify(event.target.value) || item.id } : item))}/><button className="editor-icon-button" onClick={() => setSections(sections.filter((_, index) => index !== sectionIndex))}><Trash2 size={15}/></button></div>
    {section.blocks.map((block, blockIndex) => <div className="editor-block" key={block.id}><div className="editor-block-tools"><span>{blockNames[block.type]}</span><span><button className="editor-icon-button" onClick={() => moveBlock(sectionIndex, blockIndex, -1)}><ArrowUp size={14}/></button><button className="editor-icon-button" onClick={() => moveBlock(sectionIndex, blockIndex, 1)}><ArrowDown size={14}/></button><button className="editor-icon-button" onClick={() => setSections(sections.map((item, index) => index === sectionIndex ? { ...item, blocks: item.blocks.filter((_, childIndex) => childIndex !== blockIndex) } : item))}><Trash2 size={14}/></button></span></div><BlockFields block={block} onChange={(next) => updateBlock(sectionIndex, blockIndex, next)} uploadImage={uploadImage}/></div>)}
    <div className="block-library">{(Object.keys(blockNames) as ArticleBlock["type"][]).map((type) => <button key={type} onClick={() => setSections(sections.map((item, index) => index === sectionIndex ? { ...item, blocks: [...item.blocks, makeBlock(type)] } : item))}><Plus size={12}/> {blockNames[type]}</button>)}</div>
  </div>)}
  <div className="editor-actions"><button className="admin-secondary" onClick={() => setSections([...sections, { id: `section-${sections.length + 1}`, label: `Новый раздел ${sections.length + 1}`, blocks: [makeBlock("paragraph")] }])}><Plus size={15}/> Добавить раздел</button><button className="admin-secondary" disabled={saving} onClick={() => save("draft")}><Save size={15}/> Сохранить черновик</button><button className="admin-primary" disabled={saving} onClick={() => save("published")}><Send size={15}/> Опубликовать</button>{message && <span className="admin-saving">{message}</span>}</div></div>
  <aside className="editor-panel editor-preview"><div className="editor-preview-head"><strong><Eye size={15}/> Предпросмотр</strong><span className="admin-status">{article.status || "draft"}</span></div><div className="article-body">{sections.map((section) => <section id={section.id} key={section.id}><ArticleBlockRenderer blocks={section.blocks}/></section>)}</div></aside></div>;
}
