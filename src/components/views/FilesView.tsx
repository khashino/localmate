import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { askLocalMate, embedText } from "../../lib/llamaClient";
import {
  getIndexedFolders,
  getRecentFiles,
  indexFolder,
  IndexedFolder,
  parseDocument,
  RecentFile,
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
        `[${index + 1}] File: ${result.file_name}\nChunk: ${result.chunk_index}\nPath: ${result.file_path}\nContent:\n${result.content}`
    )
    .join("\n\n---\n\n");
}

function buildCitations(results: SearchResult[]) {
  return results
    .map(
      (result, index) =>
        `[${index + 1}] ${result.file_name} — chunk ${result.chunk_index} — score ${result.score.toFixed(
          2
        )}`
    )
    .join("\n");
}

export function FilesView({ serverOnline }: FilesViewProps) {
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const [selectedFolderPath, setSelectedFolderPath] = useState("");
  const [fileText, setFileText] = useState("");
  const [question, setQuestion] = useState("");
  const [output, setOutput] = useState("");
  const [citations, setCitations] = useState("");
  const [busy, setBusy] = useState(false);
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
    setCitations("");

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
      setCitations("");
    }
  }

  async function runIndexFolder() {
    if (!selectedFolderPath || busy) return;

    setBusy(true);
    setOutput("Indexing folder...");
    setCitations("");

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

  async function summarizeFile() {
    if (!fileText.trim() || busy) return;

    if (!serverOnline) {
      setOutput("Model server is offline. Start llama-server first.");
      return;
    }

    setBusy(true);
    setOutput("");
    setCitations("");

    try {
      const reply = await askLocalMate([
        {
          role: "system",
          content:
            "You are LocalMate's document assistant. Summarize only from the provided document text.",
        },
        {
          role: "user",
          content: `Summarize this document clearly.\n\nFile: ${selectedFilePath}\n\nText:\n${fileText.slice(
            0,
            9000
          )}`,
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
    setCitations("");

    try {
      const embedding = await embedText(trimmed);
      const results = await searchIndex(
        trimmed,
        selectedFolderPath || null,
        embedding ? JSON.stringify(embedding) : null,
        6
      );

      if (results.length === 0) {
        setOutput("No relevant indexed chunks found. Try indexing a folder first.");
        return;
      }

      const context = buildContext(results);

      const reply = await askLocalMate([
        {
          role: "system",
          content:
            "You are LocalMate's folder Q&A assistant. Answer only using the provided context. Cite sources using [1], [2], etc. If missing, say you cannot find it.",
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion:\n${trimmed}`,
        },
      ]);

      setOutput(reply);
      setCitations(buildCitations(results));
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

          <button
            className="secondary-button"
            onClick={runIndexFolder}
            disabled={busy || !selectedFolderPath}
          >
            Index folder
          </button>

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

          {citations && (
            <>
              <div className="panel-header">
                <h2>Citations</h2>
              </div>
              <div className="citation-box">{citations}</div>
            </>
          )}
        </div>
      </div>
    </TaskLayout>
  );
}
