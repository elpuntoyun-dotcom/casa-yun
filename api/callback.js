// Decap CMS GitHub OAuth 回调.
// GitHub 授权后带 ?code=...&state=... 跳回这里;
// 这里用 client_secret 向 GitHub 换 access_token,
// 再按 Decap 约定的 postMessage 格式把 token 交给 /admin 页面。
// client_secret 只活在服务端环境变量里,绝不进浏览器。

export default async function handler(req, res) {
  const fail = (msg) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><html><body><script>
      (function () {
        var payload = 'authorization:github:error:' + ${JSON.stringify(
          JSON.stringify({ message: String(msg) })
        )};
        if (window.opener) { window.opener.postMessage(payload, '*'); }
      })();
    </script><p>GitHub 登录失败:${String(msg).replace(/</g, '&lt;')}</p></body></html>`);
  };

  try {
    const { code, state } = req.query || {};
    const cookie = req.headers.cookie || '';
    const m = cookie.match(/decap_oauth_state=([^;]+)/);
    if (!code || !state || !m || m[1] !== state) {
      fail('Invalid OAuth state, please try logging in again.');
      return;
    }
    // state 一次性有效,立即清除.
    res.setHeader(
      'Set-Cookie',
      'decap_oauth_state=deleted; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
    );

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const callbackUrl = `https://${host}/api/callback`;
    const tokenRes = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: callbackUrl,
        }),
      }
    );
    const data = await tokenRes.json();
    if (!data.access_token) {
      fail(data.error_description || data.error || 'Could not obtain access token.');
      return;
    }

    const payload = JSON.stringify({
      token: data.access_token,
      provider: 'github',
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><html><body><script>
      (function () {
        var msg = 'authorization:github:success:' + ${JSON.stringify(payload)};
        if (window.opener) { window.opener.postMessage(msg, '*'); }
      })();
    </script><p>登录成功,窗口会自动关闭…</p>
    <script>setTimeout(function(){ window.close(); }, 800);</script></body></html>`);
  } catch (e) {
    fail('Unexpected error during login.');
  }
}
