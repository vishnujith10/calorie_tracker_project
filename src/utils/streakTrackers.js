/**
 * Emotional & Motivating Streak Tracking System
 * Based on psychological motivators for habit formation and long-term engagement
 */

/**
 * Workout Streak Tracker
 * Features: Milestones, forgiving buffer, recovery bonus, positive-only messaging
 */
export class WorkoutStreakTracker {
  constructor(streakData = {}) {
    this.streakCount = streakData.streakCount || 0;
    this.lastActive = streakData.lastActive ? new Date(streakData.lastActive) : null;
    this.maxStreak = streakData.maxStreak || 0;
    this.buffer = streakData.buffer || 2; // forgiving missed days
    this.recoveryBonus = streakData.recoveryBonus || false;
    this.milestones = [7, 14, 21, 30, 100];
  }

  logWorkout(date) {
    const workoutDate = new Date(date);
    
    if (!this.lastActive) {
      // first workout
      this.streakCount = 1;
      this.lastActive = workoutDate;
      this.maxStreak = Math.max(this.maxStreak, this.streakCount);
      return this.rewardUser();
    }

    const daysBetween = this.daysSince(this.lastActive, workoutDate);

    if (daysBetween === 1) {
      this.streakCount++;
      this.buffer = 2;
      this.maxStreak = Math.max(this.maxStreak, this.streakCount);
      this.lastActive = workoutDate;
      return this.checkMilestone();
    } else if (daysBetween > 1 && daysBetween <= this.buffer + 1) {
      // Forgiving: allow missed days (buffer)
      this.streakCount++;
      this.buffer -= (daysBetween - 1);
      this.maxStreak = Math.max(this.maxStreak, this.streakCount);
      this.lastActive = workoutDate;
      return this.checkMilestone();
    } else if (daysBetween === 0) {
      // Same day - don't increment streak
      return this.sameDayMessage();
    } else {
      // Streak broken, apply emotional recovery bonus
      this.recoveryBonus = true;
      this.streakCount = Math.max(1, Math.floor(this.streakCount / 2));
      this.lastActive = workoutDate;
      this.buffer = 2;
      return this.recoveryMessage();
    }
  }

  daysSince(last, current) {
    const lastDate = new Date(last);
    const currentDate = new Date(current);
    lastDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);
    return Math.floor((currentDate - lastDate) / (1000 * 3600 * 24));
  }

  checkMilestone() {
    if (this.milestones.includes(this.streakCount)) {
      return {
        message: `🏆 You reached a ${this.streakCount}-day workout streak! Celebrate with a badge or reward.`,
        isMilestone: true,
        streakCount: this.streakCount
      };
    }
    return this.positiveCue();
  }

  positiveCue() {
    let message = "";
    if (this.streakCount === 1) {
      message = "👏 First day! You're building a new habit!";
    } else if (this.streakCount < 7) {
      message = `🌱 ${this.streakCount}-day streak! Keep it up – every day counts!`;
    } else if (this.streakCount < 21) {
      message = `💪 ${this.streakCount}-day streak! You're gaining momentum!`;
    } else {
      message = `🔥 ${this.streakCount}-day streak! You're unstoppable!`;
    }
    
    return {
      message,
      isMilestone: false,
      streakCount: this.streakCount
    };
  }

  rewardUser() {
    return {
      message: "🎉 You've started a workout streak! Keep moving for emotional rewards and health!",
      isMilestone: false,
      streakCount: this.streakCount
    };
  }

  recoveryMessage() {
    return {
      message: "💪 Streak paused, but your progress doesn't disappear! Come back and get a Recovery Bonus—rebuild your streak twice as fast for 3 days!",
      isRecovery: true,
      streakCount: this.streakCount
    };
  }

  sameDayMessage() {
    return {
      message: `🔥 ${this.streakCount}-day streak continues! Great work today!`,
      isMilestone: false,
      streakCount: this.streakCount
    };
  }

  getCurrentStreak() {
    // Check if streak is still active
    if (!this.lastActive) return 0;
    
    const today = new Date();
    const daysSinceLastActive = this.daysSince(this.lastActive, today);
    
    if (daysSinceLastActive > this.buffer + 1) {
      // Streak expired
      return 0;
    }
    
    return this.streakCount;
  }

  toJSON() {
    return {
      streakCount: this.streakCount,
      lastActive: this.lastActive ? this.lastActive.toISOString() : null,
      maxStreak: this.maxStreak,
      buffer: this.buffer,
      recoveryBonus: this.recoveryBonus
    };
  }
}

/**
 * Calorie Tracking Streak Tracker
 * Features: Monthly freeze, positive language, milestone badges, gentle restart
 */
export class CalorieStreakTracker {
  constructor(streakData = {}) {
    this.streakCount = streakData.streakCount || 0;
    this.maxStreak = streakData.maxStreak || 0;
    this.freezesLeft = streakData.freezesLeft !== undefined ? streakData.freezesLeft : 3; // monthly forgiving "freeze"
    this.lastLogDate = streakData.lastLogDate ? new Date(streakData.lastLogDate) : null;
    this.streakMilestones = [7, 15, 30, 100];
  }

  logCalorieTracking(date, loggedToday = true) {
    const logDate = new Date(date);
    
    if (!this.lastLogDate) {
      // First log
      if (loggedToday) {
        this.streakCount = 1;
        this.lastLogDate = logDate;
        this.maxStreak = 1;
        return this.firstLogMessage();
      }
      return null;
    }

    const daysSinceLastLog = this.daysSince(this.lastLogDate, logDate);

    if (daysSinceLastLog === 0) {
      // Same day - already logged
      return this.sameDayMessage();
    }

    if (loggedToday) {
      if (daysSinceLastLog === 1) {
        // Consecutive day
        this.streakCount++;
        this.lastLogDate = logDate;
        this.maxStreak = Math.max(this.maxStreak, this.streakCount);
        return this.streakCue();
      } else if (daysSinceLastLog > 1) {
        // Missed days - check if we can use freeze
        if (this.freezesLeft > 0 && daysSinceLastLog <= 3) {
          // Use freeze to maintain streak
          this.freezesLeft--;
          this.streakCount++;
          this.lastLogDate = logDate;
          this.maxStreak = Math.max(this.maxStreak, this.streakCount);
          return this.streakPauseMessage();
        } else {
          // Streak broken - restart
          this.streakCount = 1;
          this.lastLogDate = logDate;
          return this.encouragingRestartMessage();
        }
      }
    } else {
      // Not logged today
      if (daysSinceLastLog > 1) {
        // Streak broken
        this.streakCount = 0;
        return this.encouragingRestartMessage();
      }
    }
  }

  daysSince(last, current) {
    const lastDate = new Date(last);
    const currentDate = new Date(current);
    lastDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);
    return Math.floor((currentDate - lastDate) / (1000 * 3600 * 24));
  }

  streakCue() {
    if (this.streakMilestones.includes(this.streakCount)) {
      return {
        message: `🥇 Wow! ${this.streakCount} days of logging – badge unlocked!`,
        isMilestone: true,
        streakCount: this.streakCount
      };
    }
    
    let message = "";
    if (this.streakCount < 7) {
      message = `❤️ ${this.streakCount}-day calorie logging streak. Every log is progress!`;
    } else if (this.streakCount < 30) {
      message = `💚 ${this.streakCount}-day streak: habits and health improving every day!`;
    } else {
      message = `🌟 Amazing! ${this.streakCount}-day streak. You're an inspiration!`;
    }
    
    return {
      message,
      isMilestone: false,
      streakCount: this.streakCount
    };
  }

  streakPauseMessage() {
    return {
      message: `⏸ Streak paused (freeze used, ${this.freezesLeft} left) – life happens! You still keep your progress. Log tomorrow to continue your streak.`,
      isFreeze: true,
      streakCount: this.streakCount,
      freezesLeft: this.freezesLeft
    };
  }

  encouragingRestartMessage() {
    return {
      message: `🔄 Streak restarted. Every day is a fresh start and your progress isn't lost. Your all-time best (${this.maxStreak} days) is waiting to be beaten!`,
      isRestart: true,
      streakCount: this.streakCount,
      maxStreak: this.maxStreak
    };
  }

  firstLogMessage() {
    return {
      message: "🎉 You've started a calorie tracking streak! Every log brings you closer to your goals!",
      isMilestone: false,
      streakCount: this.streakCount
    };
  }

  sameDayMessage() {
    return {
      message: `🔥 ${this.streakCount}-day streak continues! Keep logging!`,
      isMilestone: false,
      streakCount: this.streakCount
    };
  }

  getCurrentStreak() {
    if (!this.lastLogDate) return 0;
    
    const today = new Date();
    const daysSinceLastLog = this.daysSince(this.lastLogDate, today);
    
    // Streak is active if logged today or yesterday
    if (daysSinceLastLog > 1) {
      return 0;
    }
    
    return this.streakCount;
  }

  resetMonthlyFreezes() {
    this.freezesLeft = 3;
  }

  toJSON() {
    return {
      streakCount: this.streakCount,
      maxStreak: this.maxStreak,
      freezesLeft: this.freezesLeft,
      lastLogDate: this.lastLogDate ? this.lastLogDate.toISOString() : null
    };
  }
}

