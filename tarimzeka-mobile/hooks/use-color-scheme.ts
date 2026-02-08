import { useColorScheme as useRNColorScheme } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export function useColorScheme() {
    const systemScheme = useRNColorScheme();
    const { isDark } = useTheme();
    return isDark ? 'dark' : (systemScheme ?? 'light');
}
