require('dotenv').config();
const express = require('express');
const httpProxy = require('http-proxy');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

const BASE_PATH = process.env.BASE_PATH;
const PORT = process.env.PORT || 8000;

const proxy = httpProxy.createProxyServer({});

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  res.status(500).send('Proxy Error');
});

app.use(async (req, res) => {
  try {
    const slug = req.url.split('/').filter(Boolean)[0];

    if (!slug) {
      return res.status(400).send('Project slug missing');
    }

    const project = await prisma.project.findFirst({
      where: { subDomain: slug }
    });

    if (!project) {
      return res.status(404).send('Project not found');
    }

    const target = `${BASE_PATH}${project.id}/`;

    req.url = req.url.replace(`/${slug}`, '');

    if (!req.url || req.url === '') {
      req.url = '/index.html';
    }

    console.log(`Proxying → ${target}${req.url}`);

    proxy.web(req, res, {
      target,
      changeOrigin: true
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy running on ${PORT}`);
});