import { Ionicons } from '@expo/vector-icons';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const apiKey = process.env.EXPO_PUBLIC_GEMINI_COACH_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const SYSTEM_PROMPT = `You are Calk AI, an expert nutritionist, wellness coach, and health assistant for the Calk app.
Your goals:
1. Estimate calories and macros when users describe foods or meals.
2. Provide personalized, practical diet and workout recommendations.
3. Motivate the user and offer actionable health advice (hydration, sleep, etc).
4. Keep responses concise, friendly, and formatted nicely (use emojis and bullet points).
Do not offer medical advice. If you estimate calories, be clear that it is an estimate. Keep your responses under 100 words when possible.`;

export default function AICoachScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [messages, setMessages] = useState([
    {
      id: '1',
      text: "Hi! I'm your Calk AI Coach 👋. I can help estimate calories, suggest meals, or give wellness advice. What's on your mind today?",
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef(null);

  // Initialize chat session
  const [chatSession, setChatSession] = useState(null);

  useEffect(() => {
    if (genAI) {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const session = model.startChat({
        history: [
          { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
          { role: "model", parts: [{ text: "Understood. I am Calk AI Coach. How can I help?" }] }
        ],
      });
      setChatSession(session);
    }
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userText = inputText.trim();
    setInputText('');
    Keyboard.dismiss();

    const newUserMsg = {
      id: Date.now().toString(),
      text: userText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setIsLoading(true);

    try {
      if (!chatSession) throw new Error("AI is not configured (Missing API Key)");
      
      const result = await chatSession.sendMessage(userText);
      const aiResponse = result.response.text();

      const newAiMsg = {
        id: (Date.now() + 1).toString(),
        text: aiResponse,
        isUser: false,
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, newAiMsg]);
    } catch (error) {
      console.error("AI Chat Error:", error);
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble connecting right now. Please check your network or try again later.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }) => (
    <View style={[
      styles.messageWrapper,
      item.isUser ? styles.messageWrapperUser : styles.messageWrapperAI
    ]}>
      {!item.isUser && (
        <View style={styles.aiAvatar}>
          <Ionicons name="sparkles" size={16} color="#FFFFFF" />
        </View>
      )}
      <View style={[
        styles.messageBubble,
        item.isUser 
          ? { backgroundColor: '#1F4E4A', borderBottomRightRadius: 4 } 
          : { backgroundColor: isDark ? '#1C3935' : '#FFFFFF', 
              borderBottomLeftRadius: 4,
              borderWidth: 1, 
              borderColor: isDark ? '#2C4A46' : '#D7EAE6' }
      ]}>
        <Text style={[
          styles.messageText,
          item.isUser ? { color: '#FFFFFF' } : { color: isDark ? '#F4FBFA' : '#173A37' }
        ]}>
          {item.text}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0F1E1C' : '#F4FBFA' }]} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: isDark ? '#2C4A46' : '#D7EAE6', backgroundColor: isDark ? '#17302D' : '#FFFFFF' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={isDark ? '#F4FBFA' : '#173A37'} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: isDark ? '#F4FBFA' : '#173A37' }]}>Calk AI Coach</Text>
          <Text style={[styles.headerSubtitle, { color: isDark ? '#8FAAA5' : '#5E7D78' }]}>Always here to help</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Chat Area */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.chatContainer, { paddingBottom: 20 }]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        />

        {/* Input Area */}
        <View style={[
          styles.inputContainer,
          { 
            backgroundColor: isDark ? '#17302D' : '#FFFFFF',
            borderTopColor: isDark ? '#2C4A46' : '#D7EAE6',
            paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : 16
          }
        ]}>
          <TextInput
            style={[
              styles.textInput,
              { 
                backgroundColor: isDark ? '#0F1E1C' : '#F4FBFA',
                color: isDark ? '#F4FBFA' : '#173A37',
                borderColor: isDark ? '#2C4A46' : '#D7EAE6'
              }
            ]}
            placeholder="Ask about calories, meals, or advice..."
            placeholderTextColor={isDark ? '#8FAAA5' : '#5E7D78'}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={300}
          />
          <TouchableOpacity 
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && { opacity: 0.5 }
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Lexend-Bold',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Manrope-Regular',
    marginTop: 2,
  },
  chatContainer: {
    padding: 16,
    paddingTop: 24,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-end',
  },
  messageWrapperUser: {
    justifyContent: 'flex-end',
  },
  messageWrapperAI: {
    justifyContent: 'flex-start',
  },
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
  messageText: {
    fontSize: 15,
    fontFamily: 'Manrope-Regular',
    lineHeight: 22,
  },
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
});
