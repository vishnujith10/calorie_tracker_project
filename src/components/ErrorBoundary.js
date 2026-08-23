import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
    
    // Clear navigation state when error occurs to prevent restoring to broken state
    this.clearNavigationState();
    
    // In production, you might want to log this to an error tracking service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  clearNavigationState = async () => {
    try {
      const navigationKeys = [
        '@react-navigation/navigation',
        'persist:root',
        'NAVIGATION_STATE',
      ];
      
      for (const key of navigationKeys) {
        try {
          await AsyncStorage.removeItem(key);
        } catch (e) {
          // Ignore errors if key doesn't exist
        }
      }
      
      // Also clear any navigation-related keys
      const allKeys = await AsyncStorage.getAllKeys();
      const navKeys = allKeys.filter(key => 
        key.includes('navigation') || 
        key.includes('NAVIGATION') ||
        key.includes('persist:')
      );
      if (navKeys.length > 0) {
        await AsyncStorage.multiRemove(navKeys);
      }
    } catch (error) {
      console.error('Error clearing navigation state in ErrorBoundary:', error);
    }
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Force app to restart by clearing navigation state
    // The app will go through AuthLoading again
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF6B6B" />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            The app encountered an error. Please try again.
          </Text>
          
          {__DEV__ && this.state.error && (
            <View style={styles.errorDetails}>
              <Text style={styles.errorText}>
                {this.state.error.toString()}
              </Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.button} 
            onPress={this.handleReset}
          >
            <Text style={styles.buttonText}>Restart App</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  errorDetails: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    maxHeight: 200,
    width: '100%',
  },
  errorText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#7B61FF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorBoundary;

