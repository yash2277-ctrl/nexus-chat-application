# Nexus Chat - Appwrite Deployment Guide

This repository is now set up for Appwrite Hosting and Appwrite Cloud only.

## What to deploy

Deploy the `client/` app as your Appwrite-hosted frontend.

## Appwrite Console setup

1. Create or open your Appwrite project.
2. Add a **Web** platform for your Appwrite Hosting domain.
3. Add these environment variables in Appwrite Hosting:

```env
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=69ea8ab4002d951ad4fe
VITE_APPWRITE_DATABASE_ID=69ea8bed002722169e62
VITE_APPWRITE_USER_COLLECTION_ID=69ea8c7f0023492752fa
VITE_APPWRITE_MESSAGE_COLLECTION_ID=69ea8cbf001a5ab705f0
VITE_APPWRITE_STORAGE_ID=69ea8d0a0001199a7474
```

## Build settings

Use these build settings in Appwrite Hosting:

- Build command: `npm install --prefix client && npm run build --prefix client`
- Output directory: `client/dist`
- Root directory: repository root

## Notes

- The app uses the Appwrite Web SDK directly.
- No Vercel or Render configuration is required.
- The old Node/Express backend is no longer part of the deployment path.
