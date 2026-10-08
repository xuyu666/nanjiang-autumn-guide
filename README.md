# 去哪里：旅行攻略生成器

这是一个 Vite + TypeScript 前端，使用 Supabase Auth 管理账户，使用 Edge Functions 加密保存用户自己的 DeepSeek API Key 并生成旅行攻略。攻略只存在于当前页面，不会保存为旅行历史。

## 本地运行

需要 Bun。先安装依赖并创建本地环境文件：

```sh
bun install
cp .env.example .env.local
bun run dev
```

Windows PowerShell 可用 `Copy-Item .env.example .env.local` 代替 `cp`。将 Supabase 项目 URL 和 Publishable Key 填入 `.env.local`。没有配置时，网站会展示未连接提示，登录和生成不可用。

## GitHub Pages 发布

网站发布在 [https://xuyu666.github.io/nanjiang-autumn-guide/](https://xuyu666.github.io/nanjiang-autumn-guide/)。推送到 `main` 后，`.github/workflows/deploy.yml` 会自动构建并部署。浏览行程页面不需要 Supabase 配置；登录和 AI 攻略补充功能需要另行配置前端 Supabase 公钥及对应服务。

## Supabase 配置

1. 创建 Supabase 项目，在 Authentication 中启用邮箱密码登录和邮箱确认。设置 Site URL 与 Redirect URLs，包含本地地址 `http://localhost:5173` 和正式网站地址。
2. 为正式注册邮件配置自定义 SMTP。Supabase 默认邮件服务只适用于受限的开发测试场景。
3. 使用项目的 Publishable Key 填写前端 `.env.local`。Publishable Key 可以出现在浏览器，Service Role Key 绝不能进入前端环境变量。
4. 生成加密 secret：

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

   本地运行 Edge Functions 时，将 `supabase/functions/.env.example` 复制为 `.env.local`，设置 `APP_ORIGIN=http://localhost:5173` 和本地加密 secret；以 `supabase functions serve --env-file supabase/functions/.env.local` 启动。函数只接受 `APP_ORIGIN` 指定的来源；生产环境请配置正式站点 origin。

5. 将项目连接到 CLI，应用数据库迁移并设置 Edge Function secrets：

   ```sh
   bun run supabase login
   bun run supabase link --project-ref YOUR_PROJECT_REF
   bun run supabase db push
   bun run supabase secrets set APP_ORIGIN=https://your-site.example
   bun run supabase secrets set DEEPSEEK_KEY_ENCRYPTION_SECRET=PASTE_GENERATED_BASE64_SECRET
   bun run supabase functions deploy manage-api-key
   bun run supabase functions deploy generate-guide
   ```

   `APP_ORIGIN` 填写网站正式 origin，不带路径。Supabase Edge Runtime 自动提供 `SUPABASE_URL`、`SUPABASE_ANON_KEY` 和 `SUPABASE_SERVICE_ROLE_KEY`。加密 secret 一旦更换，旧密钥将无法解密；更换前应要求用户重新保存 DeepSeek Key。

## 测试和质量检查

```sh
bun run test
bun run test:e2e
bun run build
bun run typecheck
bun run supabase:db:test
```

首次运行浏览器冒烟测试前，安装 Chromium：`node node_modules/@playwright/test/cli.js install chromium`。数据库测试需要 Supabase CLI 和本地 Docker 环境。可用 `bun run supabase:start` 启动本地服务，`bun run supabase:stop` 停止。

## 数据与密钥安全

- 浏览器只保存 Supabase 用户会话，不读取或持久化 DeepSeek Key。
- Edge Function 按用户 ID 查询密钥；数据库只保存 AES-GCM 密文，RLS 开启且浏览器角色没有密钥表权限。
- Service Role Key 和 `DEEPSEEK_KEY_ENCRYPTION_SECRET` 仅设置在 Edge Function 环境中，不得提交到 Git。
- 生成请求会把出发地、目的地和已解密的个人 API Key 发送到 DeepSeek。不要在函数日志中记录请求体、授权头或密钥。
- 生成内容未经过实时搜索核验。出行前请自行检查官方交通、天气、价格、开放时间和道路信息。
