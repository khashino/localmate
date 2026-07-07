import { useEffect, useMemo, useState } from "react";
import {
  deletePrompt,
  exportPromptsJson,
  getSavedPrompts,
  importPromptsJson,
  savePrompt,
  SavedPrompt,
  updatePrompt,
} from "../../lib/tauriCommands";
import { TaskLayout } from "./TaskLayout";

const categories = [
  "General",
  "Chat",
  "Write",
  "Code",
  "Files",
  "Translator",
  "Meetings",
  "Automation",
];

export function PromptsView() {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [content, setContent] = useState("");
  const [importText, setImportText] = useState("");
  const [log, setLog] = useState("Create, edit, import, and export reusable prompts.");

  async function loadPrompts() {
    setPrompts(await getSavedPrompts());
  }

  useEffect(() => {
    loadPrompts();
  }, []);

  const filteredPrompts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return prompts.filter((prompt) => {
      const matchesCategory =
        categoryFilter === "All" || prompt.category === categoryFilter;

      const matchesSearch =
        !query ||
        prompt.title.toLowerCase().includes(query) ||
        prompt.category.toLowerCase().includes(query) ||
        prompt.content.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [prompts, search, categoryFilter]);

  function resetForm() {
    setSelectedId(null);
    setTitle("");
    setCategory("General");
    setContent("");
  }

  function selectPrompt(prompt: SavedPrompt) {
    setSelectedId(prompt.id);
    setTitle(prompt.title);
    setCategory(prompt.category || "General");
    setContent(prompt.content);
  }

  async function saveCurrentPrompt() {
    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (!cleanTitle || !cleanContent) {
      setLog("Title and content are required.");
      return;
    }

    try {
      if (selectedId) {
        setLog(await updatePrompt(selectedId, cleanTitle, category, cleanContent));
      } else {
        setLog(await savePrompt(cleanTitle, category, cleanContent));
      }

      await loadPrompts();
      resetForm();
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Could not save prompt.");
    }
  }

  async function deleteCurrentPrompt() {
    if (!selectedId) return;

    try {
      setLog(await deletePrompt(selectedId));
      await loadPrompts();
      resetForm();
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Could not delete prompt.");
    }
  }

  async function copyPrompt() {
    if (!content.trim()) return;
    await navigator.clipboard.writeText(content);
    setLog("Prompt copied to clipboard.");
  }

  async function exportPrompts() {
    try {
      const json = await exportPromptsJson();
      setImportText(json);
      await navigator.clipboard.writeText(json);
      setLog("Prompts exported to clipboard and shown in the import/export box.");
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Could not export prompts.");
    }
  }

  async function importPrompts() {
    if (!importText.trim()) {
      setLog("Paste prompt JSON first.");
      return;
    }

    try {
      setLog(await importPromptsJson(importText));
      setImportText("");
      await loadPrompts();
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Could not import prompts.");
    }
  }

  return (
    <TaskLayout>
      <div className="split-workspace">
        <div className="panel">
          <div className="panel-header">
            <h2>Prompt library</h2>
          </div>

          <input
            value={search}
            placeholder="Search prompts..."
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option>All</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>

          <div className="prompt-list">
            {filteredPrompts.length === 0 && (
              <div className="path-box">No prompts found.</div>
            )}

            {filteredPrompts.map((prompt) => (
              <button
                type="button"
                key={prompt.id}
                className={
                  selectedId === prompt.id
                    ? "prompt-list-item active"
                    : "prompt-list-item"
                }
                onClick={() => selectPrompt(prompt)}
              >
                <strong>{prompt.title}</strong>
                <span>{prompt.category || "General"}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>{selectedId ? "Edit prompt" : "New prompt"}</h2>
          </div>

          <label className="field-label">
            Title
            <input
              value={title}
              placeholder="Prompt title"
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="field-label">
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Prompt
            <textarea
              className="large-input"
              value={content}
              placeholder="Write the reusable prompt here..."
              onChange={(event) => setContent(event.target.value)}
            />
          </label>

          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              onClick={saveCurrentPrompt}
            >
              {selectedId ? "Update" : "Save"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={copyPrompt}
              disabled={!content.trim()}
            >
              Copy
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={resetForm}
            >
              New
            </button>

            <button
              type="button"
              className="danger-button"
              onClick={deleteCurrentPrompt}
              disabled={!selectedId}
            >
              Delete
            </button>
          </div>

          <div className="terminal-box">{log}</div>
        </div>

        <div className="panel wide-panel">
          <div className="panel-header">
            <h2>Import / Export JSON</h2>
          </div>

          <textarea
            className="large-input"
            value={importText}
            placeholder='Paste JSON like: [{"title":"My prompt","category":"Write","content":"Rewrite this..."}]'
            onChange={(event) => setImportText(event.target.value)}
          />

          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              onClick={importPrompts}
            >
              Import JSON
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={exportPrompts}
            >
              Export JSON
            </button>
          </div>
        </div>
      </div>
    </TaskLayout>
  );
}
