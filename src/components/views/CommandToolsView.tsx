import { useEffect, useState } from "react";
import { askLocalMate } from "../../lib/llamaClient";
import {
  getSafeCommandAllowlist,
  runSafeCommand,
  SafeCommandResult,
} from "../../lib/tauriCommands";
import { TaskLayout } from "./TaskLayout";

type CommandToolsViewProps = {
  serverOnline: boolean;
};

const exampleCommands = [
  "pwd",
  "ls -la",
  "df -h",
  "free -h",
  "uptime",
  "uname -a",
  "git status --short",
  "du -h --max-depth=1 .",
];

function buildOutput(result: SafeCommandResult) {
  return `$ ${result.command}

Exit code: ${result.status}

STDOUT:
${result.stdout || "(empty)"}

STDERR:
${result.stderr || "(empty)"}`;
}

export function CommandToolsView({ serverOnline }: CommandToolsViewProps) {
  const [request, setRequest] = useState("");
  const [command, setCommand] = useState("ls -la");
  const [workingDir, setWorkingDir] = useState("");
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState(
    "Safe mode only. AI can suggest commands, but you must click Run."
  );

  useEffect(() => {
    getSafeCommandAllowlist()
      .then(setAllowlist)
      .catch(() => setAllowlist([]));
  }, []);

  async function suggestCommand() {
    const cleanRequest = request.trim();

    if (!cleanRequest) {
      setLog("Describe what you want to check first.");
      return;
    }

    if (!serverOnline) {
      setLog("Model server is offline. Start Runtime first.");
      return;
    }

    setBusy(true);
    setLog("Asking local model for a safe command...");

    try {
      const reply = await askLocalMate([
        {
          role: "system",
          content:
            "Suggest exactly one safe read-only Linux command. Return only the command, no markdown. Allowed programs: pwd, ls, cat, head, tail, grep, find, df, du, free, uptime, date, whoami, uname, id, ps, top, git status/log/diff/branch/remote/rev-parse, wc, sort, uniq, stat. Do not use sudo, rm, chmod, chown, apt, curl, wget, pipes, redirects, semicolons, &&, ||, or command substitution.",
        },
        {
          role: "user",
          content: cleanRequest,
        },
      ]);

      const cleanCommand = reply
        .replace(/```/g, "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)[0];

      if (!cleanCommand) {
        setLog("No command returned.");
        return;
      }

      setCommand(cleanCommand);
      setLog("Command suggested. Review it, then click Run safe command.");
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Could not suggest command.");
    } finally {
      setBusy(false);
    }
  }

  async function runCommand() {
    const cleanCommand = command.trim();

    if (!cleanCommand) {
      setLog("Command is empty.");
      return;
    }

    setBusy(true);
    setOutput("");
    setLog("Running safe command...");

    try {
      const result = await runSafeCommand(cleanCommand, workingDir.trim() || null);
      setOutput(buildOutput(result));
      setLog("Command finished.");
    } catch (error) {
      setOutput("");
      setLog(error instanceof Error ? error.message : "Command failed.");
    } finally {
      setBusy(false);
    }
  }

  async function summarizeOutput() {
    if (!output.trim()) {
      setLog("Run a command first.");
      return;
    }

    if (!serverOnline) {
      setLog("Model server is offline. Start Runtime first.");
      return;
    }

    setBusy(true);
    setLog("Summarizing output...");

    try {
      const reply = await askLocalMate([
        {
          role: "system",
          content:
            "Summarize command output clearly and mention anything important or suspicious. Do not invent facts.",
        },
        {
          role: "user",
          content: output,
        },
      ]);

      setOutput(`${output}

AI SUMMARY:
${reply}`);
      setLog("Output summarized.");
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Could not summarize output.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <TaskLayout>
      <div className="split-workspace">
        <div className="panel">
          <div className="panel-header">
            <h2>Safe command tools</h2>
          </div>

          <div className="terminal-box">
            Commands are allowlisted and read-only. Shell operators, sudo,
            package installs, destructive commands, and scripts are blocked.
          </div>

          <label className="field-label">
            Ask AI what command to use
            <textarea
              className="question-input"
              value={request}
              placeholder="Example: check disk usage in this project"
              onChange={(event) => setRequest(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="secondary-button"
            onClick={suggestCommand}
            disabled={busy || !request.trim()}
          >
            Suggest safe command
          </button>

          <label className="field-label">
            Working directory optional
            <input
              value={workingDir}
              placeholder="/app/projects/ai/localmate/localmate"
              onChange={(event) => setWorkingDir(event.target.value)}
            />
          </label>

          <label className="field-label">
            Command
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
            />
          </label>

          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              onClick={runCommand}
              disabled={busy || !command.trim()}
            >
              Run safe command
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={summarizeOutput}
              disabled={busy || !output.trim()}
            >
              Summarize output
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setOutput("");
                setLog("Output cleared.");
              }}
            >
              Clear
            </button>
          </div>

          <div className="terminal-box">{log}</div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Examples</h2>
          </div>

          <div className="prompt-list">
            {exampleCommands.map((item) => (
              <button
                type="button"
                className="prompt-list-item"
                key={item}
                onClick={() => setCommand(item)}
              >
                <strong>{item}</strong>
                <span>safe command</span>
              </button>
            ))}
          </div>

          <div className="panel-header">
            <h2>Allowlist</h2>
          </div>

          <div className="terminal-box">
            {allowlist.length > 0 ? allowlist.join(", ") : "Loading allowlist..."}
          </div>
        </div>

        <div className="panel wide-panel">
          <div className="panel-header">
            <h2>Output</h2>
          </div>

          <pre className="command-output">
            {busy ? "Working..." : output || "Command output will appear here."}
          </pre>
        </div>
      </div>
    </TaskLayout>
  );
}
