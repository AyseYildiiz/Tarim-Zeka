import Constants from 'expo-constants';

const fromExpoConfig = Constants?.expoConfig?.extra?.apiUrl;

export const API_URL =
    process.env.EXPO_PUBLIC_API_URL
    || fromExpoConfig
    || 'http://localhost:3000/api';