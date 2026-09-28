import React from 'react';
import ReactDOM from 'react-dom/client';
import {Provider} from 'react-redux';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import store from './utils/store';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import * as Sentry from "@sentry/react";
import {BrowserTracing} from "@sentry/tracing";
import {ReactQueryDevtools} from '@tanstack/react-query-devtools';


// Optional Sentry monitoring
const SENTRY_DSN = window.RUNTIME_CONFIG?.REACT_APP_SENTRY_DSN;
const APP_VERSION = window.RUNTIME_CONFIG?.REACT_APP_VERSION;
if (SENTRY_DSN !== undefined && SENTRY_DSN !== null && SENTRY_DSN !== '') {
    console.log('Sentry error monitoring is enabled.');
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: "frontend",
        release: APP_VERSION || undefined,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.browserProfilingIntegration(),
            Sentry.replayIntegration({
                // Additional SDK configuration goes in here, for example:
                maskAllText: true,
                blockAllMedia: true,
            }),
            Sentry.feedbackIntegration({
                // Additional SDK configuration goes in here, for example:
                colorScheme: "system",
            }),
        ],
        sendDefaultPii: false,
        tracesSampleRate: 0.25,
        replaysSessionSampleRate: 0.05,
        replaysOnErrorSampleRate: 1.0,
    });
}


const queryClient = new QueryClient();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <Provider store={store}>
                <App/>
            </Provider>
        </QueryClientProvider>
    </React.StrictMode>
);


// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
