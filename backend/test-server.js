const express = require("express");
const mongoose = require("mongoose");

const app = express();

app.use(express.json());

app.get("/test", (req, res) => {
  res.json({ message: "Test successful!" });
});

app.listen(3002, () => {
  console.log("Test server running on port 3002");
});
