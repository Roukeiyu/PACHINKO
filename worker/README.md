# 排行榜 Worker

这个目录是排行榜的后端，不参与游戏的 Vite 打包。它跑在 Cloudflare Workers 上：`GET /top` 返回前 20 名，`POST /submit` 把成绩写进本仓库的 `leaderboard-data` 分支。`main` 不会被写入，所以提交成绩不会触发 GitHub Pages 重新部署。

预置的 20 条假数据在 Worker 里和真实成绩合并。真实成绩全部留在 `leaderboard.json` 里，超过前 20 名也不会删。同一个 `runId` 只会被更新成更高的分数。`/top` 用 Cache API 缓存 45 秒。每个 IP 每分钟最多提交 5 次。

允许的网页来源只有 `https://roukeiyu.github.io`，以及本地的 `http://localhost`、`http://127.0.0.1`、`http://[::1]`（任意端口）。

## 你需要做的事

按这个顺序做。做完以前，游戏会继续使用浏览器里的本地排行榜，Pages 部署不受影响。

### 1. 注册 Cloudflare

打开 [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) 注册。免费计划就够用。不需要购买域名，Worker 会得到一个 `*.workers.dev` 地址。

### 2. 创建 Cloudflare API Token

1. 打开 [https://dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)。
2. 点 **Create Token**。
3. 找到模板 **Edit Cloudflare Workers**，点 **Use template**。
4. 这个模板包含部署需要的权限：Account 的 Workers Scripts（Edit）、Account Settings（Read），以及 User Details（Read）。不需要 Zone、KV、R2 或 D1 的权限。
5. Account Resources 选你刚注册的那个账号。
6. 创建后立刻复制 token。它只显示一次。这个值就是仓库 secret `CLOUDFLARE_API_TOKEN`。

### 3. 复制 Account ID

打开 [https://dash.cloudflare.com](https://dash.cloudflare.com)，进入 Workers & Pages。右侧栏有 **Account ID**。也可以从浏览器地址栏看：`https://dash.cloudflare.com/` 后面的那一段就是。这个值是仓库 secret `CLOUDFLARE_ACCOUNT_ID`。

### 4. 创建 GitHub 细粒度 token

1. 打开 GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → **Generate new token**。
2. Resource owner 选 **Roukeiyu**。
3. Repository access 选 **Only select repositories**，只勾 `Roukeiyu/PACHINKO`。
4. Permissions 里把 **Contents** 设为 **Read and write**。Metadata 会自动是只读。不要给 Actions、Administration 或其他权限。
5. 设一个到期时间，生成后复制。这个值是仓库 secret `LEADERBOARD_GITHUB_TOKEN`。到期后重新生成，再更新这个 secret，然后重新跑下面的部署。

### 5. 准备数据分支

在仓库页面用分支下拉新建分支 `leaderboard-data`，从 `main` 分出来即可。Worker 在分支不存在时也会尝试自己创建；先建好可以少一次失败。

成绩会写到这个分支的 `leaderboard.json`。不要把这个文件合并回 `main`。

### 6. 在 GitHub 仓库里配置 3 个 secret 和 1 个变量

打开 `Roukeiyu/PACHINKO` → **Settings** → **Secrets and variables** → **Actions**。

在 **Secrets** 里新增：

| 名称 | 值 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 第 2 步的 Cloudflare token |
| `CLOUDFLARE_ACCOUNT_ID` | 第 3 步的 Account ID |
| `LEADERBOARD_GITHUB_TOKEN` | 第 4 步的 GitHub 细粒度 token |

在 **Variables** 里新增（这不是 secret）：

| 名称 | 值 |
| --- | --- |
| `VITE_LEADERBOARD_URL` | Worker 的根地址，没有路径。第一次部署完成后才能填准，见下一步 |

地址形如 `https://ponpon-leaderboard.<你的子域>.workers.dev`。不要在末尾加 `/top`。没填这个变量时，Pages 构建继续使用本地排行榜。

### 7. 触发部署

打开 **Actions** → **Deploy leaderboard worker** → **Run workflow**。`worker/` 里的文件推到 `main` 时也会自动跑。

这个工作流会先跑 Worker 测试。三个 secret 有任何一个没配时，它会打出警告并跳过部署，工作流本身算成功，也不会去碰 Pages 的工作流。secret 配齐后，它先执行 `wrangler deploy`，再把 `LEADERBOARD_GITHUB_TOKEN` 存成 Worker 的 `GITHUB_TOKEN`。Cloudflare 要等 Worker 已经存在，才能写入这个 secret。

部署日志的末尾有 Worker 地址。把那个地址（不含路径）写进变量 `VITE_LEADERBOARD_URL`。

变量是在构建游戏时写进页面的。改完变量后，再跑一次 **Deploy game to GitHub Pages**（或再推一次 `main`），线上的游戏才会开始请求 Worker。

### 8. 在哪里看成绩

- 数据文件：GitHub 上切换到 `leaderboard-data` 分支，打开 `leaderboard.json`。每次写入的提交说明类似 `score: KEN 52340`。
- 线上接口：浏览器打开 `https://<worker 地址>/top`，会看到合并后的前 20 名。
- 游戏里：Pages 重新部署后，点「排行」。本局第一次到 50000 分并且弹珠落完，会要求输入名字。
- 实时日志：本机进入 `worker/` 后运行 `npx wrangler tail`。

## 本地调试

```bash
cd worker
npm ci
echo 'GITHUB_TOKEN=github_pat_你的token' > .dev.vars
npx wrangler dev
```

`.dev.vars` 已被 git 忽略。另开一个终端，在仓库根目录运行：

```bash
VITE_LEADERBOARD_URL=http://127.0.0.1:8787 npm run dev
```

Worker 测试不需要 token，它用 Miniflare 和本机模拟的 GitHub API：

```bash
cd worker
npm test
```

## 校验规则

- 名字去掉控制字符并去掉首尾空格后，按字符数算是 1 到 12 个。
- `score` 必须是整数、10 的倍数，最小 50000，最大 999999990。
- `runId` 必须是 UUID，或游戏在没有 `randomUUID` 时生成的 `run-...-...`。
- 同一个 `runId` 已有更高或相同分数时，不写 GitHub，名字也保持第一次提交的那个。

直接写 GitHub Contents API 适合现在的提交量。文件通过这个 API 写入时大约有 1MB 上限；如果以后成绩很多，更稳的做法是用 Workers KV 或 D1 当主存储，再定时把快照同步到 `leaderboard-data`。排行榜本身仍写在 GitHub 上。

## 玩家档案

水果收集和弹珠皮肤记在 D1 数据库 `ponpon-profiles`（`1ffbecd4-483b-449b-b510-18cdf337db6b`）里，绑定名是 `DB`。表结构在 `migrations/0001_profiles.sql`。

接口都在同一个 Worker 上：

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| POST | `/register` | 名字 + 4 位数字密码，建档并返回 session token |
| POST | `/login` | 核对密码，返回 token |
| POST | `/logout` | 作废 token |
| GET | `/me` | 名字、水果数量、已解锁和正在用的皮肤 |
| POST | `/round-result` | 把这一局的水果增量加上去。同一个 `runId` 再交一次不会重复加 |
| POST | `/equip` | 装备已解锁的皮肤，空字符串换回默认金球 |

密码用盐和 PBKDF2-SHA256 保存，不明文。同一个档案连续 5 次密码错误会锁 15 分钟。每个 IP 每分钟最多尝试注册或登录 8 次。Token 只存哈希，180 天过期。请求头是 `Authorization: Bearer <token>`。

一局里每种水果最多记 500 个，五种加起来最多 1500 个。超过的请求会被拒绝。

部署档案表和 Worker 只需要这两个环境变量，不必重新设置已经在线上的 `GITHUB_TOKEN`：

```bash
cd worker
export CLOUDFLARE_API_TOKEN=你的令牌
export CLOUDFLARE_ACCOUNT_ID=dd22a49707ad958b6aff092fc9805900
npx wrangler d1 migrations apply ponpon-profiles --remote
npx wrangler deploy
```

API Token 需要原来的 Workers 部署权限，再加 Account 的 D1 Edit。没有 D1 权限时，迁移这一步会失败，排行榜的 GitHub token 不用重设。

GitHub Actions 的 `Deploy leaderboard worker` 会在 `wrangler deploy` 之前执行同一条迁移命令。档案上多出来的闪耀皮肤在 `migrations/0002_shine.sql`：给 `profiles` 加上 `shine_unlocked` 和 `best_score`。`migrations/0003_gm.sql` 再加 `is_gm`，默认 0。注册和登录都不能自己改这个字段；`/me`、登录和新建档案的响应里用 `isGm` 返回。部署时同一条 `migrations apply` 会按顺序补上还没跑过的迁移，不必改 `0001`。单局分数随 `/round-result` 的 `score` 上报，达到 1000000 且是 10 的倍数才解锁，同一个 `runId` 不会重复计算。
