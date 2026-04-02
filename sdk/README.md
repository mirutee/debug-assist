# DebugAssist Node.js SDK

Auto-capture runtime errors and send diagnostics to [DebugAssist](https://debug-assist.app).

## Install

npm install debug-assist-sdk

## Usage

const DebugAssist = require('debug-assist-sdk');

// unhandled exceptions are captured automatically via process.on('uncaughtException' / 'unhandledRejection')
DebugAssist.init({ apiKey: 'your-api-key', projectName: 'my-project' });

## Environment Variables

| Variable                 | Description                            | Default                          |
|--------------------------|----------------------------------------|----------------------------------|
| DEBUG_ASSIST_API_KEY     | Your API key                           | —                                |
| DEBUG_ASSIST_PROJECT     | Project name shown in diagnostics      | unknown                          |
| DEBUG_ASSIST_BASE_URL    | API base URL                           | https://debug-assist.onrender.com|
| DEBUG_ASSIST_ENABLED     | Set to 0 to disable                    | enabled                          |
