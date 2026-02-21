require('dotenv').config();
const express = require('express');
const httpProxy = require('http-proxy');
const { PrismaClient } = require('@prisma/client');
const cookieParser = require('cookie-parser');

const app = express();
const prisma = new PrismaClient();

const BASE_PATH = process.env.BASE_PATH;
const PORT = process.env.PORT || 8000;

const proxy = httpProxy.createProxyServer({});

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  res.status(500).send('Proxy Error');
});

app.use(cookieParser());

app.use(async (req, res) => {
  try {
    const pathParts = req.url.split('/').filter(Boolean);
    let slug = pathParts[0];
    
    // Check if the first part of the path is a real project
    let project = await prisma.project.findFirst({
      where: { subDomain: slug || "" }
    });

    // If not found in path, check if we have a saved project in a cookie
    if (!project && req.cookies?.activeProject) {
      project = await prisma.project.findUnique({
        where: { id: req.cookies.activeProject }
      });
      // In this case, the URL doesn't have the slug, so don't try to strip it
      slug = null; 
    }

    if (!project) return res.status(404).send('Project not found');

    // Save this project ID in a cookie so subsequent asset requests work
    res.cookie('activeProject', project.id, { maxAge: 900000, httpOnly: true });

    const target = `${BASE_PATH}${project.id}/`;
    
    // Clean the URL for S3
    if (slug) {
        req.url = req.url.replace(`/${slug}`, '');
    }
    
    if (!req.url || req.url === '/' || req.url === '') {
      req.url = '/index.html';
    }

    console.log(`Proxying ${req.url} for project ${project.subDomain} to ${target}`);

    proxy.web(req, res, { target, changeOrigin: true });

  } catch (err) {
    console.error("PROXY ERROR:", err);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy running on ${PORT}`);
});