/**
 * 家庭健康飲食 AI - 後端伺服器
 * 使用 Express，透過環境變數呼叫真正的 AI API
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== 工具函式 ==========

function buildSystemPrompt() {
  return `你是一位專業的家庭健康飲食顧問與食譜設計師，專門為台灣家庭設計實用、健康、符合預算的食譜。

嚴格遵守以下規則：
1. 只回傳「純 JSON」，不要有任何前後說明文字、markdown 標記或註解。
2. 所有價格與營養數據必須是「估算值」，並在欄位中標示。
3. 絕對不可推薦使用者明確排除或過敏的食材。
4. 食譜必須適合一般家庭廚房操作，步驟清楚。
5. 若條件過於嚴格而難以滿足，仍盡力產生最接近的合理食譜，並在 notes 中說明。
6. 使用繁體中文。
7. 不可宣稱食譜有醫療療效。`;
}

function buildUserPrompt(params) {
  const {
    tags = [],
    freeText = '',
    familySize = 3,
    budget = 300,
    excluded = '',
    maxCookTime = 45
  } = params;

  return `請根據以下條件，產生「一份」適合的食譜：

【飲食偏好標籤】${tags.length > 0 ? tags.join('、') : '無特別偏好'}
【自由描述】${freeText || '無'}
【家庭人數】${familySize} 人
【每餐預算】新台幣 ${budget} 元以內（盡量不要超過）
【不吃 / 過敏原】${excluded || '無'}
【最長料理時間】${maxCookTime} 分鐘以內

請嚴格依照以下 JSON 結構回傳（不要加任何其他文字）：

{
  "name": "食譜名稱",
  "description": "簡短介紹（1-2 句）",
  "tags": ["符合的標籤1", "標籤2"],
  "servings": ${familySize},
  "cookTimeMinutes": 數字,
  "cookTimeText": "約 XX 分鐘",
  "ingredients": [
    {
      "name": "食材名稱",
      "amount": 數字或字串數量,
      "unit": "單位（g、ml、顆、大匙等）",
      "estimatedPrice": 估算新台幣價格（整數）
    }
  ],
  "steps": [
    "步驟1 清楚描述",
    "步驟2"
  ],
  "totalCost": 食材總估算成本（整數）),
  "costPerPerson": 每人估算成本（整數）),
  "nutrition": {
    "calories": "約 XXX kcal（估算）",
    "protein": "約 XX g（估算）",
    "fat": "約 XX g（估算）",
    "carbs": "約 XX g（估算）"
  },
  "allergens": ["可能含有的過敏原，若無則空陣列"],
  "safetyNotes": "食品安全或保存提醒（若無特殊注意事項可寫「無特殊注意事項」）",
  "notes": "其他說明，例如是否超出預算、或如何調整"
}`;
}

/**
 * 呼叫 Google Gemini API
 */
async function callGemini(systemPrompt, userPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('尚未設定 GEMINI_API_KEY，請在 .env 中填入金鑰');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: systemPrompt + '\n\n' + userPrompt }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json'
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Gemini error:', res.status, errText);
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new Error('Gemini API 金鑰無效或權限不足，請檢查 .env 中的 GEMINI_API_KEY');
    }
    if (res.status === 429) {
      throw new Error('Gemini API 額度已用完或請求過於頻繁，請稍後再試');
    }
    throw new Error(`Gemini API 錯誤（${res.status}）`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini 沒有回傳有效內容');
  }
  return text;
}

/**
 * 呼叫 OpenAI API
 */
async function callOpenAI(systemPrompt, userPrompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('尚未設定 OPENAI_API_KEY');
  }
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('OpenAI error:', res.status, errText);
    if (res.status === 401) {
      throw new Error('OpenAI API 金鑰無效，請檢查 .env');
    }
    if (res.status === 429) {
      throw new Error('OpenAI 額度不足或請求過於頻繁');
    }
    throw new Error(`OpenAI API 錯誤（${res.status}）`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * 呼叫 xAI Grok API
 */
async function callXAI(systemPrompt, userPrompt) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('尚未設定 XAI_API_KEY');
  }
  const model = process.env.XAI_MODEL || 'grok-3-mini';

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('xAI error:', res.status, errText);
    if (res.status === 401) {
      throw new Error('xAI API 金鑰無效，請檢查 .env');
    }
    if (res.status === 429) {
      throw new Error('xAI 額度不足或請求過於頻繁');
    }
    throw new Error(`xAI API 錯誤（${res.status}）`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * 解析並驗證 AI 回傳的 JSON
 */
function parseAndValidateRecipe(rawText) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  let recipe;
  try {
    recipe = JSON.parse(cleaned);
  } catch (e) {
    console.error('JSON parse failed. Raw:', cleaned.slice(0, 500));
    throw new Error('AI 回傳的內容不是有效的 JSON，請再試一次');
  }

  if (!recipe.name || typeof recipe.name !== 'string') {
    throw new Error('AI 回傳缺少有效的食譜名稱');
  }
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    throw new Error('AI 回傳缺少食材列表');
  }
  if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) {
    throw new Error('AI 回傳缺少料理步驟');
  }

  recipe.tags = Array.isArray(recipe.tags) ? recipe.tags : [];
  recipe.servings = Number(recipe.servings) || 1;
  recipe.cookTimeMinutes = Number(recipe.cookTimeMinutes) || 30;
  recipe.cookTimeText = recipe.cookTimeText || `約 ${recipe.cookTimeMinutes} 分鐘`;
  recipe.totalCost = Number(recipe.totalCost) || 0;
  recipe.costPerPerson = Number(recipe.costPerPerson) || Math.round(recipe.totalCost / recipe.servings);
  recipe.nutrition = recipe.nutrition || {
    calories: '估算中',
    protein: '估算中',
    fat: '估算中',
    carbs: '估算中'
  };
  recipe.allergens = Array.isArray(recipe.allergens) ? recipe.allergens : [];
  recipe.safetyNotes = recipe.safetyNotes || '無特殊注意事項';
  recipe.notes = recipe.notes || '';
  recipe.description = recipe.description || '';

  recipe.ingredients = recipe.ingredients.map((ing) => ({
    name: String(ing.name || '未知食材'),
    amount: ing.amount != null ? String(ing.amount) : '',
    unit: ing.unit ? String(ing.unit) : '',
    estimatedPrice: Number(ing.estimatedPrice) || 0
  }));

  recipe.steps = recipe.steps.map((s) => String(s));

  return recipe;
}

// ========== API 路由 ==========

app.post('/api/generate-recipe', async (req, res) => {
  try {
    const {
      tags = [],
      freeText = '',
      familySize = 3,
      budget = 300,
      excluded = '',
      maxCookTime = 45
    } = req.body;

    const size = Math.max(1, Math.min(12, Number(familySize) || 3));
    const budgetNum = Math.max(50, Number(budget) || 300);
    const cookTime = Math.max(10, Math.min(120, Number(maxCookTime) || 45));

    const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt({
      tags,
      freeText: String(freeText).slice(0, 200),
      familySize: size,
      budget: budgetNum,
      excluded: String(excluded).slice(0, 200),
      maxCookTime: cookTime
    });

    console.log(`[${new Date().toISOString()}] 使用 ${provider} 生成食譜...`);

    let rawText;
    if (provider === 'openai') {
      rawText = await callOpenAI(systemPrompt, userPrompt);
    } else if (provider === 'xai') {
      rawText = await callXAI(systemPrompt, userPrompt);
    } else {
      rawText = await callGemini(systemPrompt, userPrompt);
    }

    const recipe = parseAndValidateRecipe(rawText);

    const overBudget = recipe.totalCost > budgetNum;
    recipe.overBudget = overBudget;
    recipe.requestedBudget = budgetNum;

    console.log(`成功生成：${recipe.name}（約 NT$${recipe.totalCost}）`);

    res.json({
      success: true,
      recipe,
      provider,
      isAI: true
    });
  } catch (err) {
    console.error('生成失敗:', err.message);
    res.status(500).json({
      success: false,
      error: err.message || '生成食譜時發生未知錯誤',
      isAI: false
    });
  }
});

// 健康檢查
app.get('/api/health', (req, res) => {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  let hasKey = false;
  if (provider === 'gemini') hasKey = !!process.env.GEMINI_API_KEY;
  else if (provider === 'openai') hasKey = !!process.env.OPENAI_API_KEY;
  else if (provider === 'xai') hasKey = !!process.env.XAI_API_KEY;

  res.json({
    status: 'ok',
    provider,
    hasApiKey: hasKey,
    message: hasKey
      ? `已設定 ${provider} API 金鑰，可以產生真正的 AI 食譜`
      : `尚未設定 ${provider} 的 API 金鑰，請參考 .env.example`
  });
});

// 前端路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  家庭健康飲食 AI 已啟動`);
  console.log(`  網址：http://localhost:${PORT}`);
  console.log(`  AI 服務：${process.env.AI_PROVIDER || 'gemini'}`);
  console.log(`========================================\n`);
});
