import { useState } from "react";
import { askLocalMate } from "../../lib/llamaClient";
import { TaskLayout } from "./TaskLayout";

type TranslatorViewProps = {
  serverOnline: boolean;
};

const languages = [
  "English",
  "Persian",
  "Arabic",
  "Turkish",
  "French",
  "German",
  "Spanish",
  "Italian",
  "Russian",
  "Chinese",
  "Japanese",
  "Korean",
];

const tones = [
  "Natural",
  "Formal",
  "Friendly",
  "Professional",
  "Simple",
  "Academic",
];

export function TranslatorView({ serverOnline }: TranslatorViewProps) {
  const [sourceLanguage, setSourceLanguage] = useState("Auto detect");
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [tone, setTone] = useState("Natural");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  async function translate() {
    const trimmed = input.trim();

    if (!trimmed || busy) return;

    if (!serverOnline) {
      setOutput("Model server is offline. Start llama-server from Settings first.");
      return;
    }

    setBusy(true);
    setOutput("");

    try {
      const reply = await askLocalMate([
        {
          role: "system",
          content:
            "You are LocalMate Translator. Translate accurately. Preserve meaning, formatting, names, numbers, code blocks, URLs, and technical terms. Do not add explanations unless asked.",
        },
        {
          role: "user",
          content: `Translate the following text.

Source language: ${sourceLanguage}
Target language: ${targetLanguage}
Tone: ${tone}

Rules:
- Return only the translated text.
- Preserve line breaks and formatting.
- Preserve code, commands, paths, and URLs.
- If a phrase should not be translated, keep it as-is.

Text:
${trimmed}`,
        },
      ]);

      setOutput(reply || "No translation returned.");
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Unknown translation error.");
    } finally {
      setBusy(false);
    }
  }

  async function swapLanguages() {
    if (sourceLanguage === "Auto detect") return;

    const oldSource = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(oldSource);
    setInput(output);
    setOutput(input);
  }

  async function copyOutput() {
    if (!output.trim()) return;
    await navigator.clipboard.writeText(output);
  }

  return (
    <TaskLayout>
      <div className="split-workspace">
        <div className="panel">
          <div className="panel-header">
            <h2>Translate</h2>
          </div>

          <div className="settings-two-cols">
            <label className="field-label">
              From
              <select
                value={sourceLanguage}
                onChange={(event) => setSourceLanguage(event.target.value)}
              >
                <option>Auto detect</option>
                {languages.map((language) => (
                  <option key={language}>{language}</option>
                ))}
              </select>
            </label>

            <label className="field-label">
              To
              <select
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
              >
                {languages.map((language) => (
                  <option key={language}>{language}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="field-label">
            Tone
            <select value={tone} onChange={(event) => setTone(event.target.value)}>
              {tones.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <textarea
            className="large-input"
            value={input}
            placeholder="Paste text to translate..."
            onChange={(event) => setInput(event.target.value)}
          />

          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              disabled={busy || !input.trim()}
              onClick={translate}
            >
              Translate
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={busy || sourceLanguage === "Auto detect"}
              onClick={swapLanguages}
            >
              Swap
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setInput("");
                setOutput("");
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Result</h2>
          </div>

          <div className="output-box">
            {busy ? "Translating..." : output || "Translation will appear here."}
          </div>

          <button
            type="button"
            className="secondary-button"
            disabled={!output.trim()}
            onClick={copyOutput}
          >
            Copy result
          </button>
        </div>
      </div>
    </TaskLayout>
  );
}
