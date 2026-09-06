# Yrkie Agent Plugin

在支持本地 stdio MCP 的 Agent 中绑定 Yrkie 账号并查询自己的项目数量。MIT 开源，通信层不依赖 Codex、Claude Code 或任何模型 SDK。

当前版本只提供账号绑定、绑定状态、项目数量和解绑。创建、编辑、保存和导出 PPT，以及订阅权益不在此版本中。平台必须部署并启用对应接口，安装插件本身不会启用服务端功能。

## 从源码安装

需要 Node.js 22 或更新版本，以及支持本地 stdio MCP 的 Agent。凭据存储使用 Windows Credential Manager、macOS Keychain 或 Linux Secret Service；无桌面 Linux/远程容器需要先配置可用且已解锁的 Secret Service。不能使用明文凭据文件代替。只支持远程 HTTP MCP 的客户端目前不能接入这个本地服务。

```sh
git clone https://github.com/wuyoujae/yrkie-skills.git
cd yrkie-skills
npm ci --ignore-scripts
npm run build
node scripts/mcp-config.mjs
```

最后一行输出通用 MCP JSON：把 `mcpServers.yrkie` 的 command 和 args 填入 Agent 的 MCP 配置。客户端的配置文件位置、外层字段名可能不同，以其 MCP 设置界面为准；没有统一的跨客户端插件安装目录。

Skill 单独安装：把完整 `skills/yrkie-account/` 文件夹（包括 `references/`）复制到目标 Agent 的 Skill 目录，或者通过它支持的本地 Skill 导入功能加载。只支持 MCP、不支持 Skill 的客户端仍然可以使用五个工具，但不会自动加载 Schema 教程。

本地开发时直接把 origin 写入生成的启动参数，重启 Agent 即可，不需要继承终端环境变量：

```sh
node scripts/mcp-config.mjs --origin http://127.0.0.1:7622
```

生成的配置含本机源码绝对路径，请保留该目录；不要把本机配置提交到公开仓库。开发机的 `mcp.local.json` 已被 Git 忽略。

### 可选客户端快捷安装

以下脚本只是两个常见客户端的安装适配器，不影响其他 Agent 使用上述通用配置：

```sh
node scripts/install.mjs codex
# 或
node scripts/install.mjs claude
# 本地调试示例（二选一，不要重复注册）
node scripts/install.mjs codex --origin http://127.0.0.1:7622
node scripts/install.mjs claude --origin http://127.0.0.1:7622
```

安装脚本通过客户端官方 CLI 注册 MCP，并安装同一份 Skill；不会改写已有同名 MCP 或不同内容的 Skill。请保留这个源码目录，安装后重启 Agent。更新代码后重新运行 `npm ci --ignore-scripts` 和 `npm run build`；Skill 内容变化时先检查已安装副本，再手动同步。

也提供 `.codex-plugin/plugin.json` 和 `.claude-plugin/plugin.json` 供插件打包使用。Claude 本地插件模式可在构建后运行 `claude --plugin-dir .`，此时不再执行上述安装脚本，避免重复注册。插件市场的缓存副本同样需要安装依赖和构建；本仓库不依赖安装钩子自动执行代码，也尚未发布 npm 包或官方插件市场版本。

## 使用

对 Agent 说：**“绑定我的 Yrkie 账号，然后告诉我有多少个项目。”**

1. Agent 展示一个完整、短期有效的授权链接。
2. 点击链接，在官网登录，核对当前账号并点击 Connect；无需复制绑定码。
3. 返回 Agent 告知已确认；Agent 完成绑定并查询数量。

不要把密码、网站 Cookie 或访问凭据贴进聊天。项目数与 Library 一致：统计所有项目类型，排除已删除和归档项目；平台错误不会返回假造的 0。

授权仅包含 `projects:count`，有效期 30 天。到期后重新绑定。可以对 Agent 说“解绑 Yrkie”，也可以在网站账户菜单的 **Agent 账号绑定** 页面撤销任一设备。Codex 和 Claude Code 在同一操作系统用户及同一服务地址下共享绑定，解绑会使这份共享绑定失效。每个账号最多 20 个有效授权。

## 工具

Skill 保存组件 Schema 和 MCP 工作流，所有平台操作必须通过 MCP。Skill 不包含平台 HTTP 路由、请求方法或直接调用脚本；工具缺失时不能通过读取客户端源码、curl 或浏览器脚本绕过 MCP。Schema 参考按需加载，查询账号和项目数量时无需读取。

当前 Skill 附带 Schema v4.21 / authoring edition 10 的组件合同，可用于理解格式或准备本地 JSON 草稿；当前 MCP 没有创建、编辑、保存或导出工具，草稿不代表平台已创建项目。服务端仍负责验证与执行。

开源 MCP 客户端里的请求路径可以被查看，不能把隐藏路径当作安全边界。权限、身份、数量限制和后续收费权益必须在平台强制执行。

| 工具 | 用途 |
| --- | --- |
| `yrkie_bind_account` | 开始绑定，返回可点击的短期授权链接 |
| `yrkie_complete_binding` | 单次检查授权结果；遵守返回的等待间隔 |
| `yrkie_account_status` | 查看绑定状态和当前账号 |
| `yrkie_project_count` | 查询当前账号的真实项目数量 |
| `yrkie_unbind_account` | 撤销授权并清除本机凭据 |

绑定过程只保存在 MCP 进程内，重启后需要重新开始未完成的绑定。已完成的绑定保存在系统凭据库中。网络故障时解绑不清除本机凭据，以便重试；系统凭据库写入失败且自动撤销失败时，请在官网撤销新授权。

## 开发与验证

```sh
npm test
npm audit --omit=dev --registry=https://registry.npmjs.org
```

服务器启动参数 `--origin` 优先于 `YRKIE_ORIGIN` 环境变量，默认 `https://yrkie.com`，禁止路径、查询参数、URL 密码和跨域重定向。只允许 HTTPS；本地调试可显式使用 loopback HTTP。开发环境凭据与生产 origin 隔离。工具调用本身不接受服务器地址或 userId 参数。

凭据绝不写入仓库、MCP 配置或工具结果。平台数据库、认证判断、项目统计和付费规则属于平台服务；此仓库只实现公开协议客户端。

参考：[MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)、[系统凭据库](https://github.com/Brooooooklyn/keyring-node)、[Codex MCP](https://developers.openai.com/codex/mcp)、[Claude Code 插件](https://code.claude.com/docs/en/plugins-reference)、[设备授权协议](https://www.rfc-editor.org/rfc/rfc8628)。
