import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '../lib/supabase';

const MinimalSignupTestScreen = () => {
  useEffect(() => {
    supabase.auth.signUp({
      email: 'testuser' + Math.floor(Math.random() * 10000) + '@example.com',
      password: 'test1234',
    }).then(({ data, error }) => {
      console.log('Minimal signup test:', { data, error });
    });
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <StatusBar style="auto" />
      <Text>Running minimal signup test... Check your logs.</Text>
    </View>
  );
};

export default MinimalSignupTestScreen; 