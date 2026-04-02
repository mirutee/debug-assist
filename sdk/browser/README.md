# DebugAssist Browser SDK

Auto-capture frontend errors and send diagnostics to [DebugAssist](https://debug-assist.app).

## Install

### CDN (easiest)

```html
<script src="https://debug-assist.onrender.com/sdk/browser.js"
        data-api-key="YOUR_API_KEY"
        data-project="my-app"></script>
```

### npm

```bash
npm install debug-assist-browser
```

```js
import DebugAssist from 'debug-assist-browser';
DebugAssist.init({ apiKey: 'your-api-key', projectName: 'my-app' });
```

## Framework Integration

### React (ErrorBoundary)

```jsx
import { ErrorBoundary } from 'debug-assist-browser/react';

<ErrorBoundary apiKey="YOUR_API_KEY" projectName="my-app" fallback={<p>Something went wrong.</p>}>
  <App />
</ErrorBoundary>
```

### Vue 3

```js
import DebugAssistPlugin from 'debug-assist-browser/vue';
app.use(DebugAssistPlugin, { apiKey: 'YOUR_API_KEY', projectName: 'my-app' });
```

### Svelte

```js
import { initDebugAssist } from 'debug-assist-browser/svelte';
initDebugAssist({ apiKey: 'YOUR_API_KEY', projectName: 'my-app' });
```

## Environment Variables

| Variable                 | Description                            | Default                          |
|--------------------------|----------------------------------------|----------------------------------|
| DEBUG_ASSIST_API_KEY     | Your API key                           | —                                |
| DEBUG_ASSIST_PROJECT     | Project name shown in diagnostics      | unknown                          |
| DEBUG_ASSIST_BASE_URL    | API base URL                           | https://debug-assist.onrender.com|
| DEBUG_ASSIST_ENABLED     | Set to 0 to disable                    | enabled                          |
