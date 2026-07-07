import React from "react";
import ReactDOM from "react-dom/client";
import { LocalMateApp } from "./app/LocalMateApp";
import { BubbleWindow } from "./components/BubbleWindow";
import { isBubbleWindow } from "./lib/windowMode";
import "./app/localmate.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isBubbleWindow() ? <BubbleWindow /> : <LocalMateApp />}
  </React.StrictMode>
);
