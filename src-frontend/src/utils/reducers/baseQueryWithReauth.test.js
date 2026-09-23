import {baseQueryWithReauth} from './baseQueryWithReauth';

const jwt = (expiresInSeconds) =>
    'h.' + btoa(JSON.stringify({exp: Math.floor(Date.now() / 1000) + expiresInSeconds})) + '.s';

const jsonRes = (status, body = {}) =>
    new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});

const api = {endpoint: 'test', signal: undefined, abort: () => {}, getState: () => ({}), dispatch: () => {}, extra: undefined, type: 'query', forced: false};
const call = () => baseQueryWithReauth({url: 'workout/'}, api, {});

const urlOf = (c) => (typeof c[0] === 'string' ? c[0] : c[0].url);
const refreshCalls = () => global.fetch.mock.calls.filter((c) => urlOf(c).includes('token/refresh'));

beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
    delete window.location;
    window.location = {pathname: '/dashboard', search: '', href: ''};
});

test('refreshes once for parallel requests whose access token is expired', async () => {
    localStorage.setItem('access_token', jwt(-60));
    localStorage.setItem('refresh_token', 'refresh-abc');
    global.fetch.mockImplementation((req) =>
        Promise.resolve(urlOf([req]).includes('token/refresh')
            ? jsonRes(200, {access: jwt(300)})
            : jsonRes(200, {ok: true})));

    const results = await Promise.all([call(), call(), call()]);

    expect(refreshCalls()).toHaveLength(1);
    expect(localStorage.getItem('access_token')).not.toBe(jwt(-60));
    results.forEach((r) => expect(r.data).toEqual({ok: true}));
});

test('does not refresh while the access token is still valid', async () => {
    localStorage.setItem('access_token', jwt(300));
    localStorage.setItem('refresh_token', 'refresh-abc');
    global.fetch.mockResolvedValue(jsonRes(200, {ok: true}));

    await call();

    expect(refreshCalls()).toHaveLength(0);
});

test('retries the request after a 401 from the server', async () => {
    localStorage.setItem('access_token', jwt(300));
    localStorage.setItem('refresh_token', 'refresh-abc');
    let first = true;
    global.fetch.mockImplementation((req) => {
        if (urlOf([req]).includes('token/refresh')) return Promise.resolve(jsonRes(200, {access: jwt(300)}));
        if (first) { first = false; return Promise.resolve(jsonRes(401, {detail: 'expired'})); }
        return Promise.resolve(jsonRes(200, {ok: true}));
    });

    const result = await call();

    expect(result.data).toEqual({ok: true});
    expect(refreshCalls()).toHaveLength(1);
});

test('keeps the tokens when the refresh fails with a server/network error', async () => {
    localStorage.setItem('access_token', jwt(-60));
    localStorage.setItem('refresh_token', 'refresh-abc');
    global.fetch.mockImplementation((req) =>
        urlOf([req]).includes('token/refresh')
            ? Promise.resolve(jsonRes(503, {}))
            : Promise.resolve(jsonRes(401, {})));

    await call();

    expect(localStorage.getItem('refresh_token')).toBe('refresh-abc');
    expect(window.location.href).toBe('');
});

test('clears the tokens and redirects when the refresh token itself is rejected', async () => {
    localStorage.setItem('access_token', jwt(-60));
    localStorage.setItem('refresh_token', 'refresh-abc');
    global.fetch.mockImplementation((req) =>
        urlOf([req]).includes('token/refresh')
            ? Promise.resolve(jsonRes(401, {detail: 'token not valid'}))
            : Promise.resolve(jsonRes(401, {})));

    await call();

    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(window.location.href).toContain('/login?redirect=');
});
