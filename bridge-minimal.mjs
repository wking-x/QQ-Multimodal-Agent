/**
 * 最小可用的 DeepSeek × QQ 桥接
 *
 * 依赖：npm i ws
 * 运行：node bridge-minimal.mjs
 *
 * 前提：
 *   1. QQ 已用 NapCat 登录（launcher.bat，管理员权限）
 *   2. NapCat 的 onebot11 配置里 websocketClients 指向 ws://127.0.0.1:3100
 */

import { WebSocketServer } from 'ws';

// ————— 配置 —————
const CONFIG = {
  apiKey: process.env.DEEPSEEK_KEY || 'sk-你的key',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  port: 3100,
  maxTokens: 400,
  historyLimit: 40,
  // ⚠️ 必改：填上你自己的 QQ 号，否则谁的消息都不会回
  //    例如 allowUids: ['100000001']
  //    留空数组 [] 表示回复所有人（不建议，陌生人也能指挥她）
  allowUids: ['把这里换成你的QQ号'],
  persona: [
    '你叫「小汐」，是一只鲸鱼娘，说话软软的、孩子气的。',
    '像真人发微信：每次 1~2 句短句，口语化，不用列表。',
    '不要解释自己是 AI，不要用括号写动作。',
  ].join('\n'),
};

// ————— 上下文（按 QQ 号存，只在内存里，重启就忘）—————
const histories = new Map();
function getHistory(uid) {
  if (!histories.has(uid)) histories.set(uid, []);
  return histories.get(uid);
}
function pushHistory(uid, role, content) {
  const h = getHistory(uid);
  h.push({ role, content });
  if (h.length > CONFIG.historyLimit) h.splice(0, h.length - CONFIG.historyLimit);
}

// ————— 调模型 —————
async function askDeepSeek(uid, text) {
  pushHistory(uid, 'user', text);
  const res = await fetch(`${CONFIG.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CONFIG.apiKey}`,
    },
    body: JSON.stringify({
      model: CONFIG.model,
      messages: [
        { role: 'system', content: CONFIG.persona },
        ...getHistory(uid),
      ],
      max_tokens: CONFIG.maxTokens,
      temperature: 1,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    console.error('DeepSeek 返回', res.status, (await res.text()).slice(0, 200));
    return null;
  }
  const data = await res.json();
  const reply = (data?.choices?.[0]?.message?.content || '').trim();
  if (reply) pushHistory(uid, 'assistant', reply);
  return reply;
}

// ————— 启动前检查：没配好就别跑，免得一脸懵 —————
if (CONFIG.apiKey.includes('你的key')) {
  console.error('\n[配置错误] 请先填 DeepSeek API Key：');
  console.error('  方式一：设置环境变量 DEEPSEEK_KEY=sk-xxxx');
  console.error('  方式二：直接改本文件第 17 行的 apiKey\n');
  process.exit(1);
}
if (!CONFIG.allowUids.every((u) => /^\d{5,12}$/.test(String(u)))) {
  console.error('\n[配置错误] allowUids 里必须填数字 QQ 号，例如：');
  console.error("  allowUids: ['100000001']\n");
  process.exit(1);
}

// ————— 接 NapCat —————
const wss = new WebSocketServer({ host: '127.0.0.1', port: CONFIG.port });
console.log(`等待 NapCat 连接：ws://127.0.0.1:${CONFIG.port}`);

wss.on('connection', (ws) => {
  console.log('NapCat 已连接');

  // 收到的 API 回执（这里用不到，但别让消息堆着）
  ws.on('message', async (raw) => {
    let evt;
    try { evt = JSON.parse(raw.toString()); } catch { return; }

    if (evt.echo) return;                        // 接口回执，跳过
    if (evt.post_type !== 'message') return;     // 只处理消息事件
    if (evt.message_type !== 'private') return;  // 只处理私聊

    const uid = String(evt.user_id);
    if (CONFIG.allowUids.length && !CONFIG.allowUids.includes(uid)) {
      console.log(`忽略 ${uid}`);
      return;
    }

    const text = String(evt.raw_message || '').trim();
    if (!text) return;
    console.log(`收到 ${uid}: ${text.slice(0, 60)}`);

    const reply = await askDeepSeek(uid, text);
    if (!reply) return;

    console.log(`回复 ${uid}: ${reply.slice(0, 60)}`);
    ws.send(JSON.stringify({
      action: 'send_private_msg',
      params: {
        user_id: Number(uid),
        message: [{ type: 'text', data: { text: reply } }],
      },
      echo: 'm' + Date.now(),
    }));
  });

  ws.on('close', () => console.log('NapCat 断开'));
});

// ————— 可选：把上下文存到文件，重启不丢 —————
// 只要把 histories 换成读写 JSON 即可，参考:
// fs.writeFileSync('data/history.json', JSON.stringify([...histories]));
