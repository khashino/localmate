import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { askLocalMate, embedText } from "../../lib/llamaClient";
import {
  clearFolderIndex,
  getIndexedFolders,
  getRecentFiles,
  getUnembeddedChunks,
  indexFolder,
  IndexedFolder,
  openSourceFile,
  parseDocument,
  RecentFile,
  saveChunkEmbedding,
  searchIndex,
  SearchResult,
} from "../../lib/tauriCommands";
import { TaskLayout } from "./TaskLayout";

type FilesViewProps = {
  serverOnline: boolean;
};

function buildContext(results: SearchResult[]) {
  return results
    .map(
      (result, index) =>
        `[${index + 1}] File: ${result.file_name}
Chunk: ${result.chunk_index}
Path: ${result.file_path}
Content:
${result.content}`
    )
    .join("\n\n---\n\n");
}

function buildCitationLine(result: SearchResult, index: number) {
  return `[${index + 1}] ${result.file_name} — chunk ${result.chunk_index} — score ${result.score.toFixed(
    2
  )}`;
}

export function FilesView({ serverOnline }: FilesViewProps) {
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const [selectedFolderPath, setSelectedFolderPath] = useState("");
  const [fileText, setFileText] = useState("");
  const [question, setQuestion] = useState("");
  const [output, setOutput] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [embeddingBusy, setEmbeddingBusy] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState("");
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [indexedFolders, setIndexedFolders] = useState<IndexedFolder[]>([]);

  async function refreshLists() {
    setRecentFiles(await getRecentFiles());
    setIndexedFolders(await getIndexedFolders());
  }

  useEffect(() => {
    refreshLists();
  }, []);

  async function loadFile(path: string) {
    setSelectedFilePath(path);
    setBusy(true);
    setOutput("");
    setResults([]);

    try {
      const text = await parseDocument(path);
      setFileText(text.slice(0, 12000));
      await refreshLists();
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Could not parse file.");
    } finally {
      setBusy(false);
    }
  }

  async function chooseFile() {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Documents",
          extensions: [
            "pdf",
            "docx",
            "txt",
            "md",
            "csv",
            "json",
            "log",
            "ts",
            "tsx",
            "js",
            "jsx",
            "py",
            "rs",
            "html",
            "css",
          ],
        },
      ],
    });

    if (typeof selected === "string") {
      await loadFile(selected);
    }
  }

  async function chooseFolder() {
    const selected = await open({
      multiple: false,
      directory: true,
    });

    if (typeof selected === "string") {
      setSelectedFolderPath(selected);
      setOutput("");
      setResults([]);
      setEmbeddingProgress("");
    }
  }

  async function runIndexFolder() {
    if (!selectedFolderPath || busy) return;

    setBusy(true);
    setOutput("Indexing folder...");
    setResults([]);
    setEmbeddingProgress("");

    try {
      const result = await indexFolder(selectedFolderPath);
      setOutput(result.message);
      await refreshLists();
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Could not index folder.");
    } finally {
      setBusy(false);
    }
  }

  async function reindexFolder() {
    if (!selectedFolderPath || busy || embeddingBusy) return;

    setBusy(true);
    setOutput("Clearing old index...");
    setResults([]);
    setEmbeddingProgress("");

    try {
      await clearFolderIndex(selectedFolderPath);
      const result = await indexFolder(selectedFolderPath);
      setOutput(`Re-index complete. ${result.message}`);
      await refreshLists();
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Could not re-index folder.");
    } finally {
      setBusy(false);
    }
  }

  async function clearIndex() {
    if (!selectedFolderPath || busy || embeddingBusy) return;

    setBusy(true);
    setResults([]);
    setEmbeddingProgress("");

    try {
      const message = await clearFolderIndex(selectedFolderPath);
      setOutput(message);
      setSelectedFolderPath("");
      await refreshLists();
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Could not clear index.");
    } finally {
      setBusy(false);
    }
  }

  async function embedFolderChunks() {
    if (!selectedFolderPath || embeddingBusy) return;

    if (!serverOnline) {
      setOutput("Model server is offline. Start llama-server first.");
      return;
    }

    setEmbeddingBusy(true);
    setEmbeddingProgress("Starting embedding job...");

    let embedded = 0;
    let failed = 0;
    let batchNumber = 0;

    try {
      while (true) {
        batchNumber += 1;
        const chunks = await getUnembeddedChunks(selectedFolderPath, 12);

        if (chunks.length === 0) {
          setEmbeddingProgress(
            `Embedding complete. Saved ${embedded} embeddings. Failed ${failed}.`
          );
          break;
        }

        setEmbeddingProgress(
          `Embedding batch ${batchNumber}: ${chunks.length} chunks... Saved ${embedded}, failed ${failed}.`
        );

        for (const chunk of chunks) {
          const embedding = await embedText(chunk.content);

          if (!embedding) {
            failed += 1;
            continue;
          }

          await saveChunkEmbedding(chunk.chunk_id, JSON.stringify(embedding));
          embedded += 1;

          setEmbeddingProgress(
            `Embedding chunks... Saved ${embedded}, failed ${failed}. Latest: ${chunk.file_name} #${chunk.chunk_index}`
          );
        }

        if (batchNumber > 500) {
          setEmbeddingProgress(
            `Stopped after safety limit. Saved ${embedded} embeddings. Failed ${failed}.`
          );
          break;
        }
      }
    } catch (error) {
      setEmbeddingProgress(
        error instanceof Error ? error.message : "Embedding job failed."
      );
    } finally {
      setEmbeddingBusy(false);
    }
  }

  async function summarizeFile() {
    if (!fileText.trim() || busy) return;

    if (!serverOnline) {
      setOutput("Model server is offline. Start llama-server first.");
      return;
    }

    setBusy(true);
    setOutput("");
    setResults([]);

    try {
      const reply = await askLocalMate([
        {
          role: "system",
          content:
            "You are LocalMate's document assistant. Summarize only from the provided document text.",
        },
        {
          role: "user",
          content: `Summarize this document clearly.

File: ${selectedFilePath}

Text:
${fileText.slice(0, 9000)}`,
        },
      ]);

      setOutput(reply);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Unknown error.");
    } finally {
      setBusy(false);
    }
  }

  async function askFolder() {
    const trimmed = question.trim();

    if (!trimmed || busy) return;

    if (!serverOnline) {
      setOutput("Model server is offline. Start llama-server first.");
      return;
    }

    setBusy(true);
    setOutput("");
    setResults([]);

    try {
      const embedding = await embedText(trimmed);

      const searchResults = await searchIndex(
        trimmed,
        selectedFolderPath || null,
        embedding ? JSON.stringify(embedding) : null,
        6
      );

      if (searchResults.length === 0) {
        setOutput("No relevant indexed chunks found. Try indexing a folder first.");
        return;
      }

      const context = buildContext(searchResults);

      const reply = await askLocalMate([
        {
          role: "system",
          content:
            "You are LocalMate's folder Q&A assistant. Answer only using the provided context. Cite sources using [1], [2], etc. If the answer is missing, say you cannot find it in the indexed files.",
        },
        {
          role: "user",
          content: `Context:
${context}

Question:
${trimmed}`,
        },
      ]);

      setOutput(reply);
      setResults(searchResults);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Unknown error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <TaskLayout>
      <div className="split-workspace">
        <div className="panel">
          <div className="panel-header">
            <h2>Document</h2>
          </div>

          <button className="primary-button" onClick={chooseFile}>
            Choose PDF / DOCX / text
          </button>

          {recentFiles.length > 0 && (
            <select
              value=""
              onChange={(event) => {
                if (event.target.value) loadFile(event.target.value);
              }}
            >
              <option value="">Recent files</option>
              {recentFiles.map((file) => (
                <option key={file.id} value={file.file_path}>
                  {file.file_name}
                </option>
              ))}
            </select>
          )}

          <div className="path-box">
            {selectedFilePath || "No document selected."}
          </div>

          <div className="file-preview">
            {fileText || "Parsed document preview will appear here."}
          </div>

          <button
            className="secondary-button"
            onClick={summarizeFile}
            disabled={busy || !fileText.trim()}
          >
            Summarize document
          </button>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Folder index</h2>
          </div>

          <button className="primary-button" onClick={chooseFolder}>
            Choose folder
          </button>

          {indexedFolders.length > 0 && (
            <select
              value=""
              onChange={(event) => setSelectedFolderPath(event.target.value)}
            >
              <option value="">Indexed folders</option>
              {indexedFolders.map((folder) => (
                <option key={folder.id} value={folder.folder_path}>
                  {folder.folder_path}
                </option>
              ))}
            </select>
          )}

          <div className="path-box">
            {selectedFolderPath || "No folder selected."}
          </div>

          <div className="button-row">
            <button
              className="secondary-button"
              onClick={runIndexFolder}
              disabled={busy || !selectedFolderPath}
            >
              Index
            </button>

            <button
              className="secondary-button"
              onClick={reindexFolder}
              disabled={busy || embeddingBusy || !selectedFolderPath}
            >
              Re-index
            </button>

            <button
              className="danger-button"
              onClick={clearIndex}
              disabled={busy || embeddingBusy || !selectedFolderPath}
            >
              Clear
            </button>
          </div>

          <button
            className="secondary-button"
            onClick={embedFolderChunks}
            disabled={embeddingBusy || !selectedFolderPath || !serverOnline}
          >
            Embed chunks
          </button>

          {embeddingProgress && (
            <div className="terminal-box">{embeddingProgress}</div>
          )}

          <textarea
            className="question-input"
            value={question}
            placeholder="Ask a question about indexed files..."
            onChange={(event) => setQuestion(event.target.value)}
          />

          <button
            className="primary-button"
            onClick={askFolder}
            disabled={busy || !question.trim()}
          >
            Ask folder
          </button>
        </div>

        <div className="panel wide-panel">
          <div className="panel-header">
            <h2>Answer</h2>
          </div>

          <div className="output-box">
            {busy ? "Working..." : output || "Results will appear here."}
          </div>

          {results.length > 0 && (
            <>
              <div className="panel-header">
                <h2>Citations</h2>
              </div>

              <div className="citation-list">
                {results.map((result, index) => (
                  <div className="citation-card" key={result.chunk_id}>
                    <strong>{buildCitationLine(result, index)}</strong>
                    <span>{result.file_path}</span>
                    <p>{result.content.slice(0, 360)}...</p>
                    <button
                      type="button"
                      className="mini-button"
                      onClick={() => openSourceFile(result.file_path)}
                    >
                      Open source file
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </TaskLayout>
  );
}
