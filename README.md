# Calora 📱🥗

Calora is a smart React Native / Expo fitness and nutrition tracker powered by Google Gemini AI and Supabase. The app tracks daily calorie intake, macronutrients (protein, carbs, fat, fiber), hydration, weight, sleep, and activity with advanced AI-driven tools.

---

## 🌟 Key Features

### 📸 Photo-to-Calorie Estimation
Simply snap or upload a photo of your meal. The app uses the advanced **Gemini 3.6 Flash** vision model to identify distinct food items, estimate portion sizes, compute nutritional information (calories, protein, carbs, fat, fiber), and write a customized insight based on user oil/portion preferences.

### 🎙️ Voice-to-Calorie Logging
Describe what you ate out loud. Calk transcribes your audio and estimates the meals, portions, and complete nutritional breakdown in real-time.

### 🤖 Context-Aware AI Coach
Chat with your personal AI wellness coach (powered by Gemini). The coach has full awareness of your current day's live context (your calorie goals, logged meals, hydration intake, and weight trend) to give highly personalized, action-oriented, and encouraging guidance.

### 💾 Saved Meals Library (Meal Templates)
Create and save reusable meal templates. The meal library allows you to easily log common meals with a single tap. 

### 📈 Daily Summaries & Streaks
Keeps you motivated with a streak tracker, compassionate daily wellness analysis, and interactive progress charts.

### 💧 Hydration, Sleep & Steps Tracker
Log your daily water intake, sleep patterns, and track your daily steps (sensors integrated directly inside the app).

---

## 🛠️ Tech Stack

- **Frontend**: React Native, Expo (SDK 54), Expo Router, React Navigation, Vector Icons, Safe Area Context.
- **Backend / Database**: Supabase (PostgreSQL, Auth, RLS, Storage Buckets).
- **AI Models**: Google Gemini API (`gemini-3.6-flash` standard).

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Expo Go](https://expo.dev/go) app installed on your physical iOS/Android device, or an Emulator/Simulator.

### 2. Installation
Clone the repository, navigate to the project directory, and install dependencies:
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root of the project (if not already present) and configure the following variables:

```ini
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Gemini AI API Configuration
EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-key
EXPO_PUBLIC_GEMINI_COACH_KEY=your-gemini-coach-key

# OAuth / OAuth Scheme
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_WEB_CLIENT_ID=your-google-web-client-id
EXPO_PUBLIC_SCHEME=calk://
```

### 4. Running the Development Server
Start the Expo development server:
```bash
npx expo start --clear
```
Scan the QR code shown in the terminal with your phone using **Expo Go** or press `a` (Android) / `i` (iOS) to run in an emulator.

---

## 📂 Project Directory Structure

```
├── assets/                  # App fonts, images, and brand assets
├── src/
│   ├── caloriescreen/       # Custom camera, photo/voice calorie logs, saved meals list
│   ├── components/          # Reusable UI elements (Daily Check-in, Error Boundary)
│   ├── context/             # React Context for global state (Auth, Onboarding, Theme)
│   ├── homescreens/         # Core screens (HomeScreen, Journal, Main Dashboard, Footer)
│   ├── hydrationscreen/     # Hydration (Water) tracking features
│   ├── lib/                 # Core library initializations (Supabase connection)
│   ├── loginsignup/         # Authentication flows (Login, Signup, Google Sign-in)
│   ├── onboarding/          # Multi-step profile wizard (Goals, Activity, Preferences)
│   ├── profilescreen/       # Profile configuration and app settings
│   ├── screens/             # Extra utility screens (AI Coach, Manual Log, Speed Target)
│   ├── sleepscreen/         # Sleep tracking page
│   ├── steptrackerscreen/   # Active step tracker page
│   ├── weightscreen/        # Weight tracker & entry pages
│   └── utils/               # AI Engine integrations, API wrappers, caches, streak service
├── App.js                   # Application Entry & Navigation Stack
├── app.config.js            # Expo Configuration
└── package.json             # Core scripts and dependencies
```

---

## 🗄️ Supabase Schema Reference

### `saved_meal` Table
Stores templates of meals that users can quickly re-use.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key referencing auth.users)
- `dish_name` (Text) - Name of the saved meal
- `description` (Text) - Summary of ingredients/modifiers
- `calories` (Integer) - Estimated calories
- `protein` (Integer) - Protein in grams
- `carbs` (Integer) - Carbohydrates in grams
- `fat` (Integer) - Fat in grams
- `fiber` (Integer) - Fiber in grams
- `photo_url` (Text) - Path to the meal photo in Supabase storage
- `created_at` (Timestamp)

### `user_food_logs` Table
Stores daily meal entries logged by the user.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key)
- `meal_name` (Text)
- `calories` (Integer)
- `protein` (Integer)
- `carbs` (Integer)
- `fat` (Integer)
- `fiber` (Integer)
- `meal_type` (Text) - e.g. Breakfast, Lunch, Dinner, Saved Meal
- `created_at` (Timestamp)
