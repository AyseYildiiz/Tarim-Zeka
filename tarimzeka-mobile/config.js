import Constants from 'expo-constants';

const fromExpoConfig = Constants?.expoConfig?.extra?.apiUrl;


export const API_URL =
    process.env.EXPO_PUBLIC_API_URL
    || fromExpoConfig
    || 'https://tarimzeka-api.onrender.com/api';


//export const API_URL = 'http://192.168.1.7:3000/api';