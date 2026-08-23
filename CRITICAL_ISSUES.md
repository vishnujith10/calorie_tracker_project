# 🚨 Critical Issues - Immediate Action Required

## Security Vulnerabilities (Fix Immediately)

### 1. Password Storage in AsyncStorage ⚠️ CRITICAL

**Location**: `src/lib/supabase.js` lines 54-57

**Problem**: 
```javascript
export const rememberUser = async (email, password) => {
  await AsyncStorage.setItem('remembered_email', email);
  await AsyncStorage.setItem('remembered_password', password); // ❌ SECURITY RISK
};
```

**Risk**: Passwords stored in plaintext in device storage. Anyone with device access can extract passwords.

**Fix**:
```javascript
export const rememberUser = async (email) => {
  // Only store email, not password
  await AsyncStorage.setItem('remembered_email', email);
  // Use Supabase's built-in session persistence instead
};

// Remove password parameter and usage
```

**Impact**: High - Exposes user credentials

---

### 2. Service Role Key in Client Code ⚠️ CRITICAL

**Location**: `src/utils/api.js` line 10

**Problem**:
```javascript
const EDGE_KEY = Constants.expoConfig.extra.supabaseServiceRoleKey;
```

**Risk**: Service role key bypasses all Row Level Security. If exposed, attackers can access/modify ALL user data.

**Fix**:
1. Remove service role key from `app.config.js` and environment variables
2. Move `analyzeFood` function to Supabase Edge Function
3. Use only anon key for client-side operations
4. Authenticate Edge Functions using user session tokens

**Impact**: Critical - Complete database compromise if exposed

---

### 3. Hardcoded URLs in Source Code

**Location**: `src/utils/api.js` line 6

**Problem**:
```javascript
const BASE_URL = 'https://wdkraevjbcguvwpxscqf.functions.supabase.co';
```

**Risk**: Hardcoded URLs make deployment difficult and expose infrastructure details.

**Fix**:
```javascript
const BASE_URL = process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || 
                 Constants.expoConfig.extra.supabaseFunctionsUrl;
```

**Impact**: Medium - Operational and security concern

---

### 4. Permissive RLS Policies

**Location**: `supabase_schema.sql` line 27-28

**Problem**:
```sql
CREATE POLICY "Allow all operations for user_food_logs" ON public.user_food_logs
    FOR ALL USING (true);
```

**Risk**: Allows any authenticated user to access all food logs.

**Fix**:
```sql
DROP POLICY "Allow all operations for user_food_logs" ON public.user_food_logs;

CREATE POLICY "Users can access their own food logs" ON public.user_food_logs
    FOR ALL USING (auth.uid()::text = user_id) 
    WITH CHECK (auth.uid()::text = user_id);
```

**Impact**: High - Data privacy violation

---

## Code Quality Issues (Fix This Week)

### 5. Missing .env File in .gitignore

**Location**: `.gitignore`

**Problem**: `.env` files are not explicitly ignored (only `.env*.local`)

**Fix**: Add to `.gitignore`:
```
.env
.env.production
.env.development
```

---

### 6. Excessive Console Logging

**Location**: Multiple files, especially `src/lib/workoutApi.js`

**Problem**: Production code contains many `console.log` statements

**Fix**: 
- Use a logging library (e.g., `react-native-logs`)
- Remove or conditionally log based on environment
- Use proper log levels (error, warn, info, debug)

---

### 7. Large Component Files

**Location**: `src/homescreens/MainDashboardScreen.js` (2369+ lines)

**Problem**: Difficult to maintain, test, and debug

**Fix**: Split into smaller components:
- `DashboardHeader.js`
- `CalorieProgressCard.js`
- `StreakCard.js`
- `QuickActions.js`
- `DailyQuote.js`
- etc.

---

## Missing Critical Features

### 8. No Error Boundaries

**Problem**: No React Error Boundaries to catch and handle crashes gracefully

**Fix**: Add Error Boundary component:
```javascript
// src/components/ErrorBoundary.js
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Log to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

---

### 9. Missing Database Tables

**Problem**: Algorithm integration guide mentions tables that don't exist in schema:
- `daily_checkins`
- `adaptive_goals`
- `life_situations`

**Fix**: Either:
1. Add these tables to support algorithms
2. Or document why they're not needed/use alternative approach

---

## Action Plan

### Immediate (Today)
1. ✅ Remove password storage from `rememberUser` function
2. ✅ Remove service role key from client code
3. ✅ Fix RLS policy for `user_food_logs`

### This Week
4. ✅ Move sensitive operations to Edge Functions
5. ✅ Add `.env` to `.gitignore`
6. ✅ Add error boundaries
7. ✅ Create `.env.example` file

### This Month
8. ✅ Refactor large components
9. ✅ Add unit tests for algorithms
10. ✅ Reduce console logging
11. ✅ Add missing database tables or document

---

## Quick Commands

```bash
# Check for exposed secrets in git history
git log --all --full-history --source -- "*.env*"
git log --all --full-history --source -- "*.config.js"

# Check for security vulnerabilities
npm audit

# Search for potential secrets
grep -r "password\|secret\|key\|token" --include="*.js" --include="*.ts" src/
```

---

**Priority**: Fix items 1-4 immediately before any production deployment.

