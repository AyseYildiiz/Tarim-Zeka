import { useState } from "react";
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    Alert,
    StatusBar,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function Login() {
    const router = useRouter();
    const { signIn, isLoading } = useAuth();
    const { isDark, colors } = useTheme();
    const styles = createStyles(colors);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);



    const onLogin = async () => {
        const result = await signIn(email, password);
        if (result.success) {
            router.replace("/(tabs)");
        } else {
            Alert.alert("Hata", result.error || "Giriş başarısız");
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            <View style={styles.container}>
                <Text style={styles.title}>🌾 TarımZeka</Text>
                <Text style={styles.subtitle}>Giriş Yap</Text>

                <TextInput
                    placeholder="E-posta"
                    placeholderTextColor={colors.textTertiary}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={styles.input}
                />
                <View style={styles.passwordRow}>
                    <TextInput
                        placeholder="Şifre"
                        placeholderTextColor={colors.textTertiary}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        style={styles.passwordInput}
                    />
                    <Pressable
                        style={styles.toggleButton}
                        onPress={() => setShowPassword((prev) => !prev)}
                    >
                        <Ionicons
                            name={showPassword ? "eye-off" : "eye"}
                            size={20}
                            color={colors.primary}
                        />
                    </Pressable>
                </View>

                <Pressable style={styles.button} onPress={onLogin} disabled={isLoading}>
                    <Text style={styles.buttonText}>
                        {isLoading ? "Bekleyin..." : "Giriş Yap"}
                    </Text>
                </Pressable>

                <Pressable
                    style={styles.linkButton}
                    onPress={() => router.push("/forgot-password")}
                >
                    <Text style={styles.linkText}>Şifremi unuttum</Text>
                </Pressable>

                <Pressable
                    style={styles.linkButton}
                    onPress={() => router.push("/register")}
                >
                    <Text style={styles.linkText}>
                        Hesabın yok mu? <Text style={styles.linkTextBold}>Kayıt Ol</Text>
                    </Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const createStyles = (colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    primary: string;
    border: string;
}) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },
    container: {
        flex: 1,
        justifyContent: "center",
        padding: 24,
        gap: 16,
    },
    title: {
        fontSize: 32,
        fontWeight: "bold",
        textAlign: "center",
        color: colors.primary,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 20,
        textAlign: "center",
        color: colors.text,
        marginBottom: 24,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 16,
        backgroundColor: colors.surface,
        color: colors.text,
        fontSize: 16,
    },
    passwordRow: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.surface,
        paddingHorizontal: 16,
    },
    passwordInput: {
        flex: 1,
        paddingVertical: 16,
        color: colors.text,
        fontSize: 16,
    },
    toggleButton: {
        paddingVertical: 8,
        paddingLeft: 12,
    },
    button: {
        backgroundColor: colors.primary,
        padding: 16,
        borderRadius: 12,
        marginTop: 16,
    },
    buttonText: {
        color: "#fff",
        textAlign: "center",
        fontWeight: "bold",
        fontSize: 18,
    },
    linkButton: {
        marginTop: 16,
        padding: 8,
    },
    linkText: {
        color: colors.textSecondary,
        textAlign: "center",
        fontSize: 14,
    },
    linkTextBold: {
        color: colors.primary,
        fontWeight: "bold",
    },
});
