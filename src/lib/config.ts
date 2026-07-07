export const LOCALMATE_CONFIG = {
  appName: "LocalMate",
  provider: "llama.cpp",
  baseUrl: "http://127.0.0.1:8080",
  chatEndpoint: "/v1/chat/completions",
  model: "local-gguf",
  contextSize: 2048,
  temperature: 0.4,
  maxTokens: 512,
};
