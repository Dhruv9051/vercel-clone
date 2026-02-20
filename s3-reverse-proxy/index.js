const express = require('express')
const httpproxy = require('http-proxy');
require('dotenv').config()
const { PrismaClient } = require('@prisma/client');

const app = express();

const prisma = new PrismaClient();

const BASE_PATH = process.env.BASE_PATH;
const PORT = process.env.PORT || 8000;

const proxy = httpproxy.createProxy();

app.use(async (req, res) => {
    // Get the slug from the first part of the path
    const pathParts = req.url.split('/').filter(part => part !== '');
    const slug = pathParts[0];

    if (!slug) return res.status(400).send('Project slug missing in path');

    const project = await prisma.project.findFirst({
        where: { subDomain: slug }
    });

    if (!project) return res.status(404).send('Project not found');

    // Point to the S3 bucket path
    const resolvesTo = `${BASE_PATH}${project.id}`;

    // Rewrite the URL to remove the slug before sending to S3
    req.url = req.url.replace(`/${slug}`, '') || '/index.html';
    
    if (req.url === '/') req.url = '/index.html';

    console.log(`Resolving path ${slug} to ${resolvesTo}${req.url}`);

    return proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`S3 Reverse Proxy running on port ${PORT}`);
});
