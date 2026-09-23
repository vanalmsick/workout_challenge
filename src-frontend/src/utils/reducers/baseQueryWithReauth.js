import {fetchBaseQuery} from '@reduxjs/toolkit/query/react';
import * as Sentry from '@sentry/react';

console.log('API URL:', process.env.REACT_APP_BACKEND_URL);

const API_BASE = (process.env.REACT_APP_BACKEND_URL || '') + '/api/';

const baseQuery = fetchBaseQuery({
    baseUrl: API_BASE,
    prepareHeaders: (headers) => {
        const token = localStorage.getItem('access_token');
        headers.set('Content-Type', 'application/json');
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }
        return headers;
    },
});


export function sentryError({result, errorSource, endpointName = undefined, queryArgs = undefined}) {
    Sentry.withScope((scope) => {
        // Add request query args
        scope.setContext('Request', {
            ...queryArgs,
            endpointName,
        });

        // Add error message
        scope.setContext('Error', {
            ...result.error,
            error: result.error?.error,
        });

        // Add API request specific performance data
        const requestUrl = (process.env.REACT_APP_BACKEND_URL || '') + '/api/' + (queryArgs?.args?.url || '');
        const resourceTimings = performance.getEntriesByType('resource')
            .filter(entry => entry.name.includes(requestUrl))
            .pop();
        if (resourceTimings) {
            scope.setContext('Request Timing', {
                duration: resourceTimings.duration,
                fetchStart: resourceTimings.fetchStart,
                responseEnd: resourceTimings.responseEnd,
                requestStart: resourceTimings.requestStart,
                responseStart: resourceTimings.responseStart,
                dnsTime: resourceTimings.domainLookupEnd - resourceTimings.domainLookupStart,
                tcpTime: resourceTimings.connectEnd - resourceTimings.connectStart,
            });
        }

        // Add additional properties
        scope.setTag('network.online', navigator?.onLine);
        scope.setTag('network.connection', navigator?.connection?.effectiveType);
        scope.setTag('error.source', errorSource);
        scope.setTag('error.status', result.error?.originalStatus || result.error?.status);
        if ((result.error?.originalStatus || result.error?.status) >= 500) {
            scope.setTag('error.type', 'server');
        } else if ((result.error?.originalStatus || result.error?.status) >= 400) {
            scope.setTag('error.type', 'client');
        }

        // Raise error
        Sentry.captureException(
            new Error(`API Request failed: ${result.error?.originalStatus || result.error?.status}`)
        );
    });
}


// Access tokens live 5 minutes (SIMPLE_JWT.ACCESS_TOKEN_LIFETIME), so they routinely expire while a tab
// sits idle. Read the `exp` claim straight off the token instead of waiting for the backend to 401.
const accessTokenExpired = (token, skewMs = 10000) => {
    if (!token) return true;
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return payload.exp * 1000 - skewMs <= Date.now();
    } catch (e) {
        return true; // unparsable token - treat as expired so it gets replaced
    }
};

// Single in-flight refresh shared by every caller: a dashboard fires ~8 queries at once and without
// this they each POST /token/refresh/ in parallel (and would invalidate each other the moment
// ROTATE_REFRESH_TOKENS is ever turned on).
let refreshPromise = null;

/**
 * Exchange the refresh token for a new access token. Returns true on success.
 * Only clears the stored tokens when the backend rejects the refresh token itself (400/401) - a
 * network blip or 5xx leaves them alone so the user is not logged out over a transient failure.
 */
export const refreshAccessToken = async () => {
    if (refreshPromise) return refreshPromise; // join the refresh that is already running

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;

    refreshPromise = (async () => {
        try {
            const response = await fetch(API_BASE + 'token/refresh/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({refresh: refreshToken}),
            });
            if (response.ok) {
                const data = await response.json();
                if (!data?.access) return false;
                localStorage.setItem('access_token', data.access);
                if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
                return true;
            }
            if (response.status === 400 || response.status === 401) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
            }
            return false;
        } catch (e) {
            return false; // offline / server unreachable - keep the tokens and let the caller retry
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
};


const redirectToLogin = () => {
    if (window.location.pathname === '/login') return; // already there - don't clobber ?redirect=
    const currentUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?redirect=${currentUrl}`;
};


export const baseQueryWithReauth = async (args, api, extraOptions) => {
    // refresh up-front if the token is (nearly) expired, so requests aren't sent doomed to 401
    if (accessTokenExpired(localStorage.getItem('access_token'))) {
        await refreshAccessToken();
    }

    let result = await baseQuery(args, api, extraOptions);

    // the token may still have been rejected (server-side rotation, clock skew, blacklist) - refresh once and retry
    if (result.error?.status === 401) {
        if (await refreshAccessToken()) {
            result = await baseQuery(args, api, extraOptions);
        } else if (!localStorage.getItem('refresh_token')) {
            redirectToLogin(); // session is genuinely over
        }
    }

    // report to Sentry if not 401 (login access token needs refreshing) and 403 (forbidden - strava access rights insufficient) and 429 (too many strava sync requests) and 404 (not found after entry deletion)
    if (result.error && result.error.status !== 401 && result.error.status !== 403 && result.error.status !== 429 && result.error.status !== 404) {
        sentryError({
            result: result,
            errorSource: 'rtk-query',
            endpointName: api?.endpoint,
            queryArgs: {args, extraOptions},
        });
    }

    return result;
};
