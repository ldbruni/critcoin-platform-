import React from "react";
import ReactDOM from "react-dom/client";
import { Dapp } from "./components/Dapp";
import App from "./App";
 // ✅ Now importing the routing hub
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
//import Home from "./pages/Home";         // ← or whatever your main page is
//import Bounties from "./pages/Bounties"; // ← your new bounties page

// We import bootstrap here, but you can remove if you want
import "bootstrap/dist/css/bootstrap.css";

// Mobile CSS fixes
import "./mobile-fix.css";

// This is the entry point of your application, but it just renders the Dapp
// react component. All of the logic is contained in it.

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>

/*
root.render(
  <React.StrictMode>
    <Dapp />
  </React.StrictMode>
  */
);
