import { getRecentTrades } from "./trades";
import { getActivationKey, getDetectedProvider } from "./keys";

export const getAIContext = async () => {
  try {
    const trades = await getRecentTrades(20);
    if (!trades || trades.length === 0) {
      return "No trade history available yet.";
    }

    const context = trades.map(t => ({
      ticker: t.ticker,
      direction: t.direction,
      entry: t.entry_price,
      exit: t.exit_price,
      pnl: t.pnl,
      status: t.status,
      date: t.trade_date,
      notes: t.notes
    }));

    return `Here is the user's recent trade history (last 20 trades):\n${JSON.stringify(context, null, 2)}\n\nPlease use this data to provide insights, find patterns, or give strategy tips when asked.`;
  } catch (error) {
    console.error("Error fetching AI context:", error);
    return "Error loading trade history context.";
  }
};

export const chatWithAI = async (
  message: string,
  systemInstruction: string,
  onChunk?: (chunk: string) => void
) => {
  const activationKey = getActivationKey();
  const provider = getDetectedProvider();

  if (!activationKey || provider === 'unknown') {
    throw new Error("No valid AI activation key found. Please connect in Settings.");
  }

  if (provider === 'deepseek') {
    const payload = {
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: message }
      ],
      stream: !!onChunk
    };

    const url = "https://api.deepseek.com/chat/completions";
    console.log('Targeting URL:', url);
    console.log('Sending to DeepSeek (Stability Mode):', payload);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${activationKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API failed: ${response.statusText || response.status}. Check API balance.`);
      }

      if (onChunk && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;
    
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunkStr = decoder.decode(value, { stream: true });
            const lines = chunkStr.split("\n").filter(line => line.trim() !== "");
            for (const line of lines) {
              if (line === "data: [DONE]") break;
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.substring(6));
                  const content = data.choices[0]?.delta?.content || "";
                  if (content) onChunk(content);
                } catch (e) {
                  console.error("Error parsing stream chunk:", e, line);
                }
              }
            }
          }
        }
        return "";
      } else {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
      }
    } catch (error: any) {
      if (getActivationKey() && getDetectedProvider() === 'gemini') {
        console.warn("DeepSeek unstable, provider message:", error.message);
        throw new Error("Provider Connection Unstable. Switching to secondary engine...");
      }
      throw error;
    }
  } else if (provider === 'gemini') {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";
    const fullUrl = `${url}?key=${activationKey}`;
    console.log('Targeting URL:', fullUrl);
    console.log('Sending to Gemini...');
    
    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `System Instruction: ${systemInstruction}\n\nUser Message: ${message}` }] }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Gemini API failed. Check key validity in Settings.');
      }

      const data = await response.json();
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
      if (onChunk) onChunk(result);
      return result;
    } catch (error: any) {
      console.error("Gemini Error:", error);
      throw error;
    }
  }
  
  throw new Error("Unsupported AI provider detected.");
};

// Maintain compatibility with previous exports but use the new logic
export const chatWithDeepSeek = chatWithAI;

export const analyzeTrade = async (trade: any) => {
  const promptText = `
    AUDIT THIS TRADE:
    Symbol: ${trade.ticker}
    Market: ${trade.market_type || "Unknown"}
    Direction: ${trade.direction}
    Entry: ${trade.entry_price}
    Exit: ${trade.exit_price || "Open"}
    PnL: $${trade.pnl}
    R:R Ratio: ${trade.risk_reward_ratio || "N/A"}
    Status: ${trade.status}
    User Notes: ${trade.notes || "No notes provided."}

    Task: 
    1. Provide a 2-sentence blunt assessment of this trade.
    2. Specifically comment on the Risk/Reward ratio.
    3. Give exactly ONE actionable tip for the next trade to avoid repeating any mistakes seen here.
  `;

  const systemInstruction = "You are a High-Performance Trading Coach. Your goal is to improve the user's trading discipline. Be direct, professional, and slightly critical if they made poor risk management decisions. Focus on R:R (Risk/Reward) and emotional discipline.";

  return chatWithAI(promptText, systemInstruction);
};
