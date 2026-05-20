require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

const app = express();

app.use(cors({
  origin: [
    "https://frontend-admin.onrender.com",
    "https://frontend-caja.onrender.com",
    "https://frontend-ciudadano.onrender.com",
    "https://frontend-portal.onrender.com"
  ]
}));

app.use(express.json());
app.use(helmet());
app.use(compression());

app.get("/", (req, res) => {
  res.send("API funcionando");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo ${PORT}`);
});
