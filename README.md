# QQ-Multimodal-Agent
基于 Node.js 本地中间件，通过 OneBot11 协议连接 QQ 与 DeepSeek 大模型，实现了一个具备拟人化特征的主动性 AI 智能体。

## ✨ 核心功能
- **分层记忆系统**：基于短期（40条滑动）、长期摘要压缩及向量检索的分层记忆架构。
- **主动性决策**：结合内部状态与定时轮询，AI 自主判断并发起交互。
- **多模态调度**：支持 TTS 语音合成、生图 API 及本地系统控制。

## 🛠️ 技术栈
Node.js / WebSocket / OneBot11 / 向量检索 / DeepSeek API
