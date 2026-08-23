import { GoogleGenerativeAI } from '@google/generative-ai';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || Constants.expoConfig?.extra?.EXPO_PUBLIC_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Helper: Timeout wrapper for network requests
const raceWithTimeout = (promise, ms, timeoutMessage = 'Request timed out') => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), ms)),
  ]);
};

// Helper: Robust JSON extraction
const extractJSON = (text) => {
  try {
    // Attempt standard parse first
    return JSON.parse(text);
  } catch (e) {
    // Attempt to extract from markdown blocks or surrounding text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Could not parse JSON from AI response.');
  }
};

/**
 * Fast detection of food item names from an image.
 * Uses gemini-3.6-flash for speed.
 * @param {string} photoUri Local URI of the photo
 * @returns {Promise<Array>} Array of item objects
 */
export const detectFoodItems = async (photoUri) => {
  if (!genAI) throw new Error('AI API key is not configured.');

  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  const imageData = await FileSystem.readAsStringAsync(photoUri, { encoding: 'base64' });
  
  const prompt = `Analyze this food image and return a JSON list of the distinct food items visible. 
Do not return calories or macros. Just the names.
Keep it simple (e.g. "Rice", "Chicken Curry", "Salad"). 
Return ONLY valid JSON like this: {"items": ["Item 1", "Item 2"]}`;

  try {
    const result = await raceWithTimeout(
      model.generateContent([prompt, { inlineData: { mimeType: 'image/jpeg', data: imageData } }]),
      15000,
      'Fast detection timed out'
    );
    const text = await result.response.text();
    const data = extractJSON(text);

    if (data.items && Array.isArray(data.items)) {
      return data.items.map(name => ({ name, portion: 'Medium', oil: 'Medium', type: 'Home' }));
    } else {
      return [{ name: 'Unknown Meal', portion: 'Medium', oil: 'Medium', type: 'Home' }];
    }
  } catch (error) {
    console.log('Fast detect error:', error);
    throw error;
  }
};

/**
 * Detailed calculation of nutrition and generation of insights.
 * Uses gemini-3.6-flash with fallbacks.
 * @param {string} photoUri Local URI of the photo
 * @param {Array} refinedItems User-refined items array
 * @returns {Promise<Object>} Detailed nutrition analysis object
 */
export const calculateDetailedNutrition = async (photoUri, refinedItems) => {
  if (!genAI) throw new Error('AI API key is not configured.');

  const visionModels = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-1.5-flash'];
  const imageData = await FileSystem.readAsStringAsync(photoUri, { encoding: 'base64' });

  const prompt = `Analyze this food image and the following refined items provided by the user:
${refinedItems ? JSON.stringify(refinedItems, null, 2) : 'No manual refinements provided.'}

Provide detailed nutritional information combining the visual data with the user's specific refinements (e.g. portion size, oil level, food type). Your response MUST be a single valid JSON object and nothing else. Do not include markdown formatting.

If the image does NOT contain recognizable food items AND no manual items are provided, respond with: {"error": "No food items detected in this image. Please take a photo of food items."}

If food is detected or items are provided, provide this exact JSON structure:
{
  "dish_name": "Main dish name (e.g., 'Grilled Chicken Salad')",
  "ingredients": [
    {
      "name": "ingredient name incorporating user modifiers if applicable (e.g., 'Medium Chicken Curry, High Oil')",
      "quantity": "estimated amount"
    }
  ],
  "total_nutrition": {
    "calories": <number>,
    "protein": <number>,
    "fat": <number>,
    "carbs": <number>,
    "fiber": <number>
  },
  "insight": "A short, 1-sentence insight explaining the calorie/macro count based on the user's refinements (e.g., 'Calories are elevated due to high oil selection.' or 'Excellent high-protein home-cooked meal.')"
}

Guidelines:
- Respect the user's portion size, oil level, and type (home/restaurant) modifiers heavily when calculating calories and macros.
- Be realistic with portion sizes
- Provide nutritional values per the entire visible portion
- Insight should be helpful, not preachy.`;

  let lastError = null;

  for (const modelName of visionModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const result = await raceWithTimeout(
        model.generateContent([
          prompt,
          { inlineData: { mimeType: 'image/jpeg', data: imageData } },
        ]),
        30000,
        'Network request timed out. Please check your internet connection and try again.'
      );
      
      const response = await result.response;
      const text = response.text();
      const data = extractJSON(text);

      if (data.error) throw new Error(data.error);
      
      if (!data.dish_name || !data.total_nutrition || !Array.isArray(data.ingredients)) {
        throw new Error('Invalid JSON structure from API.');
      }
      
      return data;
    } catch (error) {
      lastError = error;
      console.log(`Model ${modelName} failed:`, error.message);
    }
  }

  throw lastError || new Error('All AI models are currently unavailable.');
};

/**
 * Generate a personalized daily summary based on nutrition and health metrics.
 * @param {Object} metrics { calories, calorieGoal, protein, proteinGoal, water, waterGoal, weightTrend, goalFocus }
 * @returns {Promise<string>} The generated summary string
 */
export const generateDailySummary = async (metrics) => {
  if (!genAI) throw new Error('AI API key is not configured.');
  
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  
  const prompt = `You are a supportive, expert nutrition coach for the app Kalry. 
Write a short, engaging daily summary (3-4 sentences max) for the user based on today's metrics:
- Calories: ${metrics.calories} kcal (Goal: ${metrics.calorieGoal})
- Protein: ${metrics.protein}g (Goal: ${metrics.proteinGoal}g)
- Water: ${metrics.water} L (Goal: ${metrics.waterGoal} L)
- Weight Trend: ${metrics.weightTrend}
- Goal Focus: ${metrics.goalFocus}

Provide actionable advice for tomorrow if they missed a goal, or praise if they hit them. 
Return ONLY the text of the summary, no markdown, no JSON, just the friendly message.`;

  try {
    const result = await raceWithTimeout(
      model.generateContent(prompt),
      15000,
      'Summary generation timed out.'
    );
    return await result.response.text();
  } catch (error) {
    console.log('Daily summary error:', error);
    return "You're doing great! Keep logging your meals to get personalized daily summaries.";
  }
};

/**
 * Context-aware AI Coach response generator.
 * @param {Array} messages Array of previous chat messages (e.g. { role: 'user', content: '...' })
 * @param {Object} context User's current day health context
 * @returns {Promise<string>} The AI's response
 */
export const askKalryContextual = async (messages, context) => {
  if (!genAI) throw new Error('AI API key is not configured.');
  
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  // 1. Build the system context block
  const systemPrompt = `You are Kalry, an expert, supportive, and highly personalized nutrition and fitness coach. 
You are currently chatting with the user in the Kalry app.

IMPORTANT: You are CONTEXT-AWARE. You have access to the user's live data for today. 
Do not ask them what they ate if it is listed below. Use this data to provide highly personalized, accurate advice.

--- USER'S LIVE CONTEXT TODAY ---
- Goal: ${context.goalFocus || 'Not specified'}
- Calories Consumed: ${context.calories || 0} kcal (Goal: ${context.calorieGoal || 2000} kcal)
- Protein Consumed: ${context.protein || 0}g (Goal: ${context.proteinGoal || 100}g)
- Water Intake: ${context.water || 0} L (Goal: ${context.waterGoal || 2.5} L)
- Latest Weight: ${context.weight ? context.weight + ' kg' : 'Not logged'}
- Meals Logged Today: ${context.meals && context.meals.length > 0 ? context.meals.join(', ') : 'None yet'}
---------------------------------

Guidelines for your response:
1. Be concise, conversational, and encouraging (1-3 short paragraphs).
2. Directly reference their live data if it answers their question (e.g., "I see you only had 40g of protein so far today from your oatmeal...").
3. Give actionable, specific advice.
4. Do NOT use markdown headers or bold text excessively. Keep it feeling like a human text message.`;

  // 2. Format history for Gemini API
  // Gemini expects history in format: { role: 'user' | 'model', parts: [{ text: '...' }] }
  const formattedHistory = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  try {
    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I have reviewed the user context and will act as Kalry, their personal expert nutrition coach.' }] },
        ...formattedHistory.slice(0, -1) // Exclude the very last message which we will send now
      ]
    });

    const lastMessage = messages[messages.length - 1].content;
    const result = await raceWithTimeout(
      chat.sendMessage(lastMessage),
      20000,
      'Response timed out. Please try again.'
    );
    
    return result.response.text();
  } catch (error) {
    console.log('Ask Kalry error:', error);
    throw new Error('Sorry, I am having trouble connecting right now. Please try again later.');
  }
};
