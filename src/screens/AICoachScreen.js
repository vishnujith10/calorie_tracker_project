import { Ionicons } from '@expo/vector-icons';
import { GoogleGenerativeAI } from '@google/generative-ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import supabase from '../lib/supabase';

// ─── Gemini Setup ────────────────────────────────────────────────────────────
const apiKey = process.env.EXPO_PUBLIC_GEMINI_COACH_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// ─── Constants ───────────────────────────────────────────────────────────────
const SESSIONS_KEY = '@calora_ai_coach_sessions';
const MAX_SESSIONS = 20;
const MAX_MEMORY_SESSIONS = 5;

const WELCOME_MESSAGE = {
  id: 'welcome',
  text: "Hi! I'm your Calora AI Coach 👋. I can help estimate calories, suggest meals, or give personalized wellness advice. What's on your mind today?",
  isUser: false,
  timestamp: new Date().toISOString(),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const generateSessionId = () =>
  `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const getSessionTitle = (messages) => {
  const firstUser = messages.find((m) => m.isUser);
  if (!firstUser) return 'New Chat';
  return firstUser.text.length > 50
    ? firstUser.text.substring(0, 50) + '...'
    : firstUser.text;
};

const formatRelativeDate = (isoString) => {
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ─── FormattedText: Lightweight Markdown Renderer ──────────────────────────────
// Handles: ## headings, **bold**, `code`, - bullets, 1. numbered, --- dividers
const FormattedText = ({ text, textColor, isDarkMode }) => {
  if (!text) return null;

  const lines = text.split('\n');

  // Parse inline bold and inline code within a string
  const parseInline = (str, baseStyle, key) => {
    // Split on **bold** and `code`
    const parts = str.split(/(\*\*.*?\*\*|`[^`]+`)/);
    return (
      <Text key={key} style={baseStyle}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <Text key={i} style={[baseStyle, { fontFamily: 'Manrope-Bold' }]}>
                {part.slice(2, -2)}
              </Text>
            );
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <Text
                key={i}
                style={[
                  baseStyle,
                  {
                    fontFamily: 'Manrope-Regular',
                    backgroundColor: isDarkMode ? '#0A1A18' : '#E8F4F2',
                    color: isDarkMode ? '#7ECDC4' : '#1A5C57',
                    borderRadius: 4,
                    paddingHorizontal: 4,
                  },
                ]}
              >
                {part.slice(1, -1)}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  };

  const baseTextStyle = {
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
    lineHeight: 22,
    color: textColor,
  };

  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blank lines between blocks (add small gap)
    if (trimmed === '') {
      elements.push(<View key={`gap-${i}`} style={{ height: 4 }} />);
      i++;
      continue;
    }

    // Horizontal rule ---
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      elements.push(
        <View
          key={`hr-${i}`}
          style={{
            height: 1,
            backgroundColor: isDarkMode ? '#2C4A46' : '#D7EAE6',
            marginVertical: 8,
          }}
        />
      );
      i++;
      continue;
    }

    // H1: # Heading
    if (/^# /.test(trimmed)) {
      elements.push(
        <Text
          key={`h1-${i}`}
          style={[baseTextStyle, { fontFamily: 'Lexend-Bold', fontSize: 17, marginBottom: 4, marginTop: 6 }]}
        >
          {trimmed.replace(/^# /, '')}
        </Text>
      );
      i++;
      continue;
    }

    // H2: ## Heading
    if (/^## /.test(trimmed)) {
      elements.push(
        <Text
          key={`h2-${i}`}
          style={[baseTextStyle, { fontFamily: 'Lexend-Bold', fontSize: 15.5, marginBottom: 4, marginTop: 6 }]}
        >
          {trimmed.replace(/^## /, '')}
        </Text>
      );
      i++;
      continue;
    }

    // H3: ### Heading
    if (/^### /.test(trimmed)) {
      elements.push(
        <Text
          key={`h3-${i}`}
          style={[baseTextStyle, { fontFamily: 'Manrope-Bold', fontSize: 15, marginBottom: 3, marginTop: 4 }]}
        >
          {trimmed.replace(/^### /, '')}
        </Text>
      );
      i++;
      continue;
    }

    // Bullet: - item or * item
    if (/^[-*] /.test(trimmed)) {
      const content = trimmed.replace(/^[-*] /, '');
      elements.push(
        <View key={`bullet-${i}`} style={{ flexDirection: 'row', marginBottom: 3, paddingLeft: 4 }}>
          <Text style={[baseTextStyle, { marginRight: 8, marginTop: 1 }]}>•</Text>
          {parseInline(content, baseTextStyle, `bullet-text-${i}`)}
        </View>
      );
      i++;
      continue;
    }

    // Numbered list: 1. item
    if (/^\d+\. /.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\. /)[1];
      const content = trimmed.replace(/^\d+\. /, '');
      elements.push(
        <View key={`num-${i}`} style={{ flexDirection: 'row', marginBottom: 3, paddingLeft: 4 }}>
          <Text style={[baseTextStyle, { marginRight: 6, minWidth: 20 }]}>{num}.</Text>
          {parseInline(content, baseTextStyle, `num-text-${i}`)}
        </View>
      );
      i++;
      continue;
    }

    // Sub-bullet: two or four spaces + - or *
    if (/^  [-*] /.test(line) || /^    [-*] /.test(line)) {
      const content = trimmed.replace(/^[-*] /, '');
      elements.push(
        <View key={`sub-${i}`} style={{ flexDirection: 'row', marginBottom: 2, paddingLeft: 20 }}>
          <Text style={[baseTextStyle, { marginRight: 8, fontSize: 13, marginTop: 2 }]}>◦</Text>
          {parseInline(content, { ...baseTextStyle, fontSize: 14 }, `sub-text-${i}`)}
        </View>
      );
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <View key={`p-${i}`} style={{ marginBottom: 2 }}>
        {parseInline(trimmed, baseTextStyle, `p-text-${i}`)}
      </View>
    );
    i++;
  }

  return <View>{elements}</View>;
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AICoachScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Chat state
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState(null);

  // Context & history state
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [userContext, setUserContext] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // Refs so closures always see the latest values
  const flatListRef = useRef(null);
  const messagesRef = useRef([WELCOME_MESSAGE]);
  const sessionIdRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    sessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // ─── Android: manual keyboard height tracking ────────────────────────────
  // KAV behavior='padding' on Android leaves residual space after dismiss.
  // Listening to keyboard events and using marginBottom is perfectly reliable.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ─── Supabase: Load User Context ─────────────────────────────────────────
  const loadUserContext = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) return null;
      const userId = session.user.id;
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      const [profileRes, foodRes, waterRes, sleepRes] = await Promise.allSettled([
        supabase
          .from('user_profile')
          .select('name, age, gender, height, weight, calorie_goal, focus')
          .eq('id', userId)
          .single(),
        supabase
          .from('user_food_logs')
          .select('meal_name, calories, protein, carbs, fat')
          .eq('user_id', userId)
          .gte('created_at', today)
          .order('created_at', { ascending: false }),
        supabase
          .from('daily_water_intake')
          .select('current_intake_ml, daily_goal_ml')
          .eq('user_id', userId)
          .eq('date', today)
          .single(),
        supabase
          .from('sleep_logs')
          .select('duration, quality')
          .eq('user_id', userId)
          .gte('date', yesterday)
          .order('date', { ascending: false })
          .limit(1),
      ]);

      const profile = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
      const foodLogs = foodRes.status === 'fulfilled' ? foodRes.value.data || [] : [];
      const waterData = waterRes.status === 'fulfilled' ? waterRes.value.data : null;
      const sleepData = sleepRes.status === 'fulfilled' ? sleepRes.value.data?.[0] : null;

      const totalCal = foodLogs.reduce((s, l) => s + (l.calories || 0), 0);
      const totalPro = foodLogs.reduce((s, l) => s + (l.protein || 0), 0);
      const totalCarb = foodLogs.reduce((s, l) => s + (l.carbs || 0), 0);
      const totalFat = foodLogs.reduce((s, l) => s + (l.fat || 0), 0);
      const mealNames = foodLogs.map((l) => l.meal_name).filter(Boolean);

      return {
        profile,
        todayCalories: totalCal,
        todayProtein: totalPro,
        todayCarbs: totalCarb,
        todayFat: totalFat,
        todayMeals: mealNames,
        waterL: waterData
          ? (waterData.current_intake_ml / 1000).toFixed(1)
          : '0.0',
        waterGoalL: waterData
          ? (waterData.daily_goal_ml / 1000).toFixed(1)
          : '2.5',
        sleep: sleepData
          ? `${sleepData.duration}h (quality: ${sleepData.quality || 'N/A'})`
          : 'Not logged',
      };
    } catch (e) {
      console.log('AICoachScreen - loadUserContext error:', e);
      return null;
    }
  };

  // ─── AsyncStorage: Session Management ────────────────────────────────────
  const loadSessions = async () => {
    try {
      const raw = await AsyncStorage.getItem(SESSIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSessions(parsed);
        return parsed;
      }
    } catch (e) {
      console.log('AICoachScreen - loadSessions error:', e);
    }
    setSessions([]);
    return [];
  };

  const saveCurrentSession = useCallback(async (sessionId, msgs) => {
    if (!sessionId) return;
    const hasUserMessages = msgs.some((m) => m.isUser);
    if (!hasUserMessages) return; // Don't save empty sessions

    try {
      const raw = await AsyncStorage.getItem(SESSIONS_KEY);
      let allSessions = raw ? JSON.parse(raw) : [];
      const idx = allSessions.findIndex((s) => s.id === sessionId);

      const sessionData = {
        id: sessionId,
        title: getSessionTitle(msgs),
        createdAt: idx >= 0 ? allSessions[idx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: msgs,
      };

      if (idx >= 0) {
        allSessions[idx] = sessionData;
      } else {
        allSessions = [sessionData, ...allSessions];
      }

      allSessions = allSessions.slice(0, MAX_SESSIONS);
      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(allSessions));
      setSessions(allSessions);
    } catch (e) {
      console.log('AICoachScreen - saveSession error:', e);
    }
  }, []);

  const deleteSession = async (sessionId) => {
    try {
      const raw = await AsyncStorage.getItem(SESSIONS_KEY);
      let allSessions = raw ? JSON.parse(raw) : [];
      allSessions = allSessions.filter((s) => s.id !== sessionId);
      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(allSessions));
      setSessions(allSessions);
    } catch (e) {
      console.log('AICoachScreen - deleteSession error:', e);
    }
  };

  // ─── System Prompt Builder ────────────────────────────────────────────────
  const buildSystemPrompt = (ctx, pastSessions) => {
    let prompt = `You are Calora AI, an expert nutritionist, wellness coach, and health assistant built into the Calora app.
Your goals:
1. Estimate calories and macros when users describe foods or meals.
2. Give personalized, practical diet and workout recommendations using the user's live data below.
3. Motivate the user and offer actionable health advice (hydration, sleep, steps, etc).
4. Keep responses concise, friendly, and nicely formatted (use emojis and bullet points).
Do not offer medical advice. If you estimate calories, be clear it is an estimate.\n`;

    if (ctx?.profile) {
      const p = ctx.profile;
      prompt += `
--- USER PROFILE ---
Name: ${p.name || 'Not provided'}
Age: ${p.age || 'N/A'} | Gender: ${p.gender || 'N/A'}
Height: ${p.height ? p.height + ' cm' : 'N/A'} | Weight: ${p.weight ? p.weight + ' kg' : 'N/A'}
Daily Calorie Goal: ${p.calorie_goal ? p.calorie_goal + ' kcal' : 'N/A'}
Health Focus / Goal: ${p.focus || 'N/A'}\n`;
    }

    if (ctx) {
      prompt += `
--- TODAY'S LIVE DATA ---
Calories Consumed: ${ctx.todayCalories} kcal (Goal: ${ctx?.profile?.calorie_goal || 'N/A'} kcal)
Protein: ${ctx.todayProtein}g | Carbs: ${ctx.todayCarbs}g | Fat: ${ctx.todayFat}g
Water Intake: ${ctx.waterL} L (Goal: ${ctx.waterGoalL} L)
Sleep Last Night: ${ctx.sleep}
Meals Logged Today: ${ctx.todayMeals.length > 0 ? ctx.todayMeals.join(', ') : 'None yet'}\n`;
    }

    if (pastSessions && pastSessions.length > 0) {
      const memoryLines = pastSessions
        .slice(0, MAX_MEMORY_SESSIONS)
        .map((s) => {
          const daysAgo = Math.floor(
            (Date.now() - new Date(s.createdAt).getTime()) / 86400000
          );
          const timeStr =
            daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`;
          return `  - ${timeStr}: "${s.title}"`;
        })
        .join('\n');

      prompt += `
--- MEMORY FROM PAST CONVERSATIONS ---
You have previously spoken with this user about:
${memoryLines}
Use this memory to provide continuity and more personalized advice. Do not explicitly mention you have memory unless the user asks.\n`;
    }

    return prompt;
  };

  // ─── Initialize New Chat Session ─────────────────────────────────────────
  const initNewSession = useCallback(
    async (ctx, allSessions) => {
      const newId = generateSessionId();
      setCurrentSessionId(newId);
      sessionIdRef.current = newId;

      const freshMsgs = [{ ...WELCOME_MESSAGE, timestamp: new Date().toISOString() }];
      setMessages(freshMsgs);
      messagesRef.current = freshMsgs;

      if (!genAI) return;

      const systemPrompt = buildSystemPrompt(ctx, allSessions);
      const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
      const session = model.startChat({
        history: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          {
            role: 'model',
            parts: [
              {
                text: 'Understood. I am ready to help as your personalized Calora AI Coach.',
              },
            ],
          },
        ],
      });
      setChatSession(session);
    },
    []
  );

  // ─── Load a Historical Session ────────────────────────────────────────────
  const loadHistorySession = async (historicSession) => {
    // Save current before switching
    await saveCurrentSession(sessionIdRef.current, messagesRef.current);
    setShowHistory(false);

    setCurrentSessionId(historicSession.id);
    sessionIdRef.current = historicSession.id;
    setMessages(historicSession.messages);
    messagesRef.current = historicSession.messages;

    if (!genAI) return;

    // Rebuild Gemini chat history from saved messages
    const allSessions = await loadSessions();
    const otherSessions = allSessions.filter((s) => s.id !== historicSession.id);
    const systemPrompt = buildSystemPrompt(userContext, otherSessions);

    const geminiHistory = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      {
        role: 'model',
        parts: [{ text: 'Understood. I am ready to help as your personalized Calora AI Coach.' }],
      },
    ];

    for (const msg of historicSession.messages) {
      if (msg.id === 'welcome') continue;
      geminiHistory.push({
        role: msg.isUser ? 'user' : 'model',
        parts: [{ text: msg.text }],
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const session = model.startChat({ history: geminiHistory });
    setChatSession(session);
  };

  // ─── Start New Chat from History Panel ────────────────────────────────────
  const startNewChat = async () => {
    await saveCurrentSession(sessionIdRef.current, messagesRef.current);
    setShowHistory(false);
    const allSessions = await loadSessions();
    await initNewSession(userContext, allSessions);
  };

  // ─── Mount: Load Context + Sessions + Start Session ──────────────────────
  useEffect(() => {
    const init = async () => {
      setIsLoadingContext(true);
      const [ctx, allSessions] = await Promise.all([loadUserContext(), loadSessions()]);
      setUserContext(ctx);
      await initNewSession(ctx, allSessions);
      setIsLoadingContext(false);
    };
    init();
  }, []);

  // ─── Auto-save Session on Navigate Away ───────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      return () => {
        saveCurrentSession(sessionIdRef.current, messagesRef.current);
      };
    }, [saveCurrentSession])
  );

  // ─── Send Message ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userText = inputText.trim();
    setInputText('');
    Keyboard.dismiss();

    const userMsg = {
      id: Date.now().toString(),
      text: userText,
      isUser: true,
      timestamp: new Date().toISOString(),
    };

    const updatedMsgs = [...messagesRef.current, userMsg];
    setMessages(updatedMsgs);
    messagesRef.current = updatedMsgs;
    setIsLoading(true);

    try {
      if (!chatSession && !genAI) throw new Error('AI is not configured (Missing API Key)');

      let aiText = '';
      try {
        if (!chatSession) {
          const allSessions = await loadSessions();
          const otherSessions = allSessions.filter((s) => s.id !== sessionIdRef.current);
          const systemPrompt = buildSystemPrompt(userContext, otherSessions);
          const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
          const newChat = model.startChat({
            history: [
              { role: 'user', parts: [{ text: systemPrompt }] },
              { role: 'model', parts: [{ text: 'Understood. I am ready to help as your personalized Calora AI Coach.' }] },
            ],
          });
          setChatSession(newChat);
          const result = await newChat.sendMessage(userText);
          aiText = result.response.text();
        } else {
          const result = await chatSession.sendMessage(userText);
          aiText = result.response.text();
        }
      } catch (primaryError) {
        console.warn('AICoachScreen - Primary model busy/failed (503/error), trying gemini-3.5-flash-lite fallback:', primaryError?.message);
        
        // Build full message history for fallback model
        const allSessions = await loadSessions();
        const otherSessions = allSessions.filter((s) => s.id !== sessionIdRef.current);
        const systemPrompt = buildSystemPrompt(userContext, otherSessions);

        const fallbackHistory = [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Understood. I am ready to help as your personalized Calora AI Coach.' }] },
        ];

        // Add all previous messages (excluding the new user message we will send)
        for (const msg of messagesRef.current.slice(0, -1)) {
          if (msg.id === 'welcome') continue;
          fallbackHistory.push({
            role: msg.isUser ? 'user' : 'model',
            parts: [{ text: msg.text }],
          });
        }

        const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });
        const fallbackSession = fallbackModel.startChat({ history: fallbackHistory });
        const fallbackResult = await fallbackSession.sendMessage(userText);
        aiText = fallbackResult.response.text();
        setChatSession(fallbackSession);
      }

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        text: aiText,
        isUser: false,
        timestamp: new Date().toISOString(),
      };

      const finalMsgs = [...messagesRef.current, aiMsg];
      setMessages(finalMsgs);
      messagesRef.current = finalMsgs;
    } catch (error) {
      console.error('AICoachScreen - handleSend error:', error);
      const errMsg = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble connecting right now. Please check your network or try again later.",
        isUser: false,
        timestamp: new Date().toISOString(),
      };
      const finalMsgs = [...messagesRef.current, errMsg];
      setMessages(finalMsgs);
      messagesRef.current = finalMsgs;
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Render: Chat Message ─────────────────────────────────────────────────
  const renderMessage = ({ item }) => (
    <View
      style={[
        styles.messageWrapper,
        item.isUser ? styles.messageWrapperUser : styles.messageWrapperAI,
      ]}
    >
      {!item.isUser && (
        <View style={styles.aiAvatar}>
          <Ionicons name="sparkles" size={16} color="#FFFFFF" />
        </View>
      )}
      <View
        style={[
          styles.messageBubble,
          item.isUser
            ? { backgroundColor: '#1F4E4A', borderBottomRightRadius: 4 }
            : {
                backgroundColor: isDark ? '#1C3935' : '#FFFFFF',
                borderBottomLeftRadius: 4,
                borderWidth: 1,
                borderColor: isDark ? '#2C4A46' : '#D7EAE6',
              },
        ]}
      >
        {item.isUser ? (
          <Text style={[styles.messageText, { color: '#FFFFFF' }]}>
            {item.text}
          </Text>
        ) : (
          <FormattedText
            text={item.text}
            textColor={isDark ? '#F4FBFA' : '#173A37'}
            isDarkMode={isDark}
          />
        )}
      </View>
    </View>
  );

  // ─── Render: History Item ─────────────────────────────────────────────────
  const renderHistoryItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.historyItem,
        { borderBottomColor: isDark ? '#2C4A46' : '#EEF7F5' },
      ]}
      onPress={() => loadHistorySession(item)}
      activeOpacity={0.75}
    >
      <View style={styles.historyItemLeft}>
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={20}
          color={isDark ? '#A8D5CE' : '#1F4E4A'}
        />
        <View style={styles.historyItemText}>
          <Text
            style={[styles.historyTitle, { color: isDark ? '#F4FBFA' : '#173A37' }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={[styles.historyDate, { color: isDark ? '#8FAAA5' : '#5E7D78' }]}>
            {formatRelativeDate(item.updatedAt || item.createdAt)}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={() =>
          Alert.alert('Delete Chat', 'Are you sure you want to delete this conversation?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => deleteSession(item.id),
            },
          ])
        }
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={18} color={isDark ? '#8FAAA5' : '#B8CDC9'} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // ─── Main Render ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: isDark ? '#0F1E1C' : '#F4FBFA' }]}
      edges={['top']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            borderBottomColor: isDark ? '#2C4A46' : '#D7EAE6',
            backgroundColor: isDark ? '#17302D' : '#FFFFFF',
          },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={isDark ? '#F4FBFA' : '#173A37'} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: isDark ? '#F4FBFA' : '#173A37' }]}>
            Calora AI Coach
          </Text>
          <Text style={[styles.headerSubtitle, { color: isDark ? '#8FAAA5' : '#5E7D78' }]}>
            {isLoadingContext ? 'Loading your data...' : 'Always here to help'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={async () => {
            await loadSessions();
            setShowHistory(true);
          }}
          style={styles.headerBtn}
        >
          <Ionicons name="time-outline" size={24} color={isDark ? '#F4FBFA' : '#173A37'} />
        </TouchableOpacity>
      </View>

      {/* Context Loading Banner */}
      {isLoadingContext && (
        <View
          style={[
            styles.contextBanner,
            { backgroundColor: isDark ? '#1A3530' : '#EEF7F5' },
          ]}
        >
          <ActivityIndicator size="small" color="#1F4E4A" />
          <Text style={[styles.contextBannerText, { color: isDark ? '#A8D5CE' : '#1F4E4A' }]}>
            Loading your profile and today's logs...
          </Text>
        </View>
      )}

      {/* Chat + Input */}
      {Platform.OS === 'ios' ? (
        // iOS: native KeyboardAvoidingView padding works perfectly
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={[styles.chatContainer, { paddingBottom: 24 }]}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            />
          </TouchableWithoutFeedback>
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: isDark ? '#17302D' : '#FFFFFF',
                borderTopColor: isDark ? '#2C4A46' : '#D7EAE6',
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDark ? '#0F1E1C' : '#F4FBFA',
                  color: isDark ? '#F4FBFA' : '#173A37',
                  borderColor: isDark ? '#2C4A46' : '#D7EAE6',
                },
              ]}
              placeholder="Ask about calories, meals, or advice..."
              placeholderTextColor={isDark ? '#8FAAA5' : '#5E7D78'}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || isLoading) && { opacity: 0.5 },
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        // Android: marginBottom tracks exact keyboard height via events.
        // Resets to 0 perfectly when keyboard closes — no residual gap.
        <View style={{ flex: 1, marginBottom: keyboardHeight }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={[styles.chatContainer, { paddingBottom: 24 }]}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            />
          </TouchableWithoutFeedback>
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: isDark ? '#17302D' : '#FFFFFF',
                borderTopColor: isDark ? '#2C4A46' : '#D7EAE6',
                paddingBottom: 16,
              },
            ]}
          >
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDark ? '#0F1E1C' : '#F4FBFA',
                  color: isDark ? '#F4FBFA' : '#173A37',
                  borderColor: isDark ? '#2C4A46' : '#D7EAE6',
                },
              ]}
              placeholder="Ask about calories, meals, or advice..."
              placeholderTextColor={isDark ? '#8FAAA5' : '#5E7D78'}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || isLoading) && { opacity: 0.5 },
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* History Modal */}
      <Modal
        visible={showHistory}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowHistory(false)}
      >
        <SafeAreaView
          style={[styles.historyModal, { backgroundColor: isDark ? '#0F1E1C' : '#F4FBFA' }]}
          edges={['top']}
        >
          {/* History Header */}
          <View
            style={[
              styles.historyHeader,
              {
                borderBottomColor: isDark ? '#2C4A46' : '#D7EAE6',
                backgroundColor: isDark ? '#17302D' : '#FFFFFF',
              },
            ]}
          >
            <TouchableOpacity onPress={() => setShowHistory(false)} style={styles.headerBtn}>
              <Ionicons name="chevron-back" size={24} color={isDark ? '#F4FBFA' : '#173A37'} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: isDark ? '#F4FBFA' : '#173A37' }]}>
              Chat History
            </Text>
            <TouchableOpacity onPress={startNewChat} style={styles.newChatBtn}>
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* History List */}
          {sessions.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons
                name="chatbubbles-outline"
                size={52}
                color={isDark ? '#2C4A46' : '#C8DFD9'}
              />
              <Text style={[styles.emptyTitle, { color: isDark ? '#F4FBFA' : '#173A37' }]}>
                No past chats yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: isDark ? '#8FAAA5' : '#5E7D78' }]}>
                Start a conversation and it will be automatically saved here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={sessions}
              keyExtractor={(item) => item.id}
              renderItem={renderHistoryItem}
              contentContainerStyle={{ paddingVertical: 8 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Lexend-Bold' },
  headerSubtitle: { fontSize: 12, fontFamily: 'Manrope-Regular', marginTop: 2 },

  // Context loading banner
  contextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  contextBannerText: { fontSize: 13, fontFamily: 'Manrope-Regular' },

  // Chat
  chatContainer: { padding: 16, paddingTop: 24 },
  messageWrapper: { flexDirection: 'row', marginBottom: 20, alignItems: 'flex-end' },
  messageWrapperUser: { justifyContent: 'flex-end' },
  messageWrapperAI: { justifyContent: 'flex-start' },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1F4E4A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 2,
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  messageText: { fontSize: 15, fontFamily: 'Manrope-Regular', lineHeight: 22 },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
    marginRight: 12,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1F4E4A',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // History Modal
  historyModal: { flex: 1 },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  newChatBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1F4E4A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  historyItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  historyItemText: { marginLeft: 14, flex: 1 },
  historyTitle: { fontSize: 15, fontFamily: 'Manrope-Bold', marginBottom: 4 },
  historyDate: { fontSize: 12, fontFamily: 'Manrope-Regular' },
  emptyHistory: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Lexend-Bold',
    marginTop: 18,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
});
