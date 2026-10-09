// Decap CMS GitHub 登录入口.
// 浏览器访问 /admin 点 "Login with GitHub" 后,
// Decap 会打开这个地址;这里把用户重定向到 GitHub 授权页。
// 需要在 Vercel 环境变量里设置 GITHUB_CLIENT_ID。
//
// 回调地址取自当前请求的域名:在 Vercel 预览域名和 casayun.com 上都能用,
// 但 GitHub OAuth App 里登记的 Authorization callback URL 必须与实际访问的
// 域名一致(换域名后去 GitHub OAuth App 设置里改)。

export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(500).send('GITHUB_CLIENT_ID is not configured on the server.');
    return;
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const callbackUrl = `https://${host}/api/callback`;
  // 随机 state 防 CSRF,存进 HttpOnly cookie,callback 时校验.
  const state =
    Math.random().toString(36).slice(2) + Date.now().toString(36);
  res.setHeader(
    'Set-Cookie',
    `decap_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: 'repo',
    state,
  });
  res.writeHead(302, {
    Location: `https://github.com/login/oauth/authorize?${params.toString()}`,
  });
  res.end();
}
