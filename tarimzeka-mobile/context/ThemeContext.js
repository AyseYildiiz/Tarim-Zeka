import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};

export const ThemeProvider = ({ children }) => {
    const [isDark, setIsDark] = useState(true);
    const [themeLoaded, setThemeLoaded] = useState(false);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem('theme');
            if (savedTheme !== null) {
                setIsDark(savedTheme === 'dark');
            }
        } catch (error) {
            console.error('Load theme error:', error);
        } finally {
            setThemeLoaded(true);
        }
    };

    const toggleTheme = async () => {
        try {
            const newTheme = !isDark ? 'dark' : 'light';
            await AsyncStorage.setItem('theme', newTheme);
            setIsDark(!isDark);
        } catch (error) {
            console.error('Toggle theme error:', error);
        }
    };

    const colors = isDark ? darkColors : lightColors;

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme, colors, themeLoaded }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const darkColors = {
    // Background
    background: '#0f172a',
    surface: '#1e293b',
    surfaceLight: '#334155',

    // Text
    text: '#fff',
    textSecondary: '#94a3b8',
    textTertiary: '#64748b',

    // Accents
    primary: '#16A34A',
    primaryLight: '#22c55e',
    primaryDark: '#15803d',

    // UI Elements
    border: '#334155',
    borderLight: '#475569',

    // Status
    success: '#16A34A',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    // Special
    card: '#1e293b',
    cardHover: '#334155',
    inputBackground: '#0f172a',
    inputBorder: '#475569',
};

export const lightColors = {
    // Background
    background: '#D6F7E8',
    surface: '#E9FBF4',
    surfaceLight: '#DFF6EE',

    // Text
    text: '#1f2933',
    textSecondary: '#335247',
    textTertiary: '#4b6b60',

    // Accents
    primary: '#12825A',
    primaryLight: '#22b07a',
    primaryDark: '#0f6a4a',

    // UI Elements
    border: '#B7E7D7',
    borderLight: '#A7E0CF',

    // Status
    success: '#16A34A',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    // Special
    card: '#DFF6EE',
    cardHover: '#D2F1E7',
    inputBackground: '#E9FBF4',
    inputBorder: '#A7E0CF',
};
