require("dotenv").config();
const express = require("express");
const httpProxy = require("http-proxy");
const { PrismaClient } = require("@prisma/client");
const cookieParser = require("cookie-parser");

const app = express();
const prisma = new PrismaClient();

const BASE_PATH = process.env.BASE_PATH;
const PORT = process.env.PORT || 8000;

const proxy = httpProxy.createProxyServer({});

proxy.on("error", (err, req, res) => {
  console.error("Proxy error:", err);
  res.status(500).send("Proxy Error");
});

app.use(cookieParser());

app.use(async (req, res) => {
  console.log(`Request: ${req.url} | Cookie ID: ${req.cookies?.activeProject}`);
  try {
    const pathParts = req.url.split("/").filter(Boolean);
    let slug = pathParts[0];
    let project;

    // Check if the URL contains a valid project slug
    const systemFiles = ['favicon.ico', 'manifest.json', 'robots.txt'];
    
    if (slug && !systemFiles.includes(slug) && slug !== 'static' && !slug.includes('.')) {
      project = await prisma.project.findFirst({ where: { subDomain: slug } });
    }

    // If no slug in URL, check the 'activeProject' cookie
    if (!project && req.cookies?.activeProject) {
      project = await prisma.project.findUnique({
        where: { id: req.cookies.activeProject },
      });
      slug = null; // Assets don't have the slug in their URL
    }

    if (!project) return res.status(404).send("Project not found");

    // Save project ID in cookie so the assets work
    res.cookie("activeProject", project.id, {
      maxAge: 900000,
      httpOnly: true,
      sameSite: "Lax", // Allows the cookie to be sent on top-level navigations
      path: "/", // Ensures cookie is available for all paths
    });

    const target = `${BASE_PATH}${project.id}/`;

    // Clean URL: Remove slug if present, otherwise default to index.html
    if (slug) req.url = req.url.replace(`/${slug}`, "");
    if (!req.url || req.url === "/" || req.url === "") req.url = "/index.html";

    return proxy.web(req, res, { target, changeOrigin: true });
  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Proxy running on ${PORT}`);
});
