import { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    Alert,
    SafeAreaView,
    StatusBar,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { API_URL } from "../config";
import { useTheme } from "../context/ThemeContext";

export default function ResetPassword() {
    const router = useRouter();
    const params = useLocalSearchParams<{ token?: string }>();
    const { isDark, colors } = useTheme();
    const styles = createStyles(colors);

    const [token, setToken] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (params.token) {
            setToken(String(params.token));
        }
    }, [params.token]);

    const onSubmit = async () => {
        if (!token.trim()) {
            Alert.alert("Hata", "Sıfırlama kodu gerekli");
            return;
        }
        if (!password.trim() || password.length < 6) {
            Alert.alert("Hata", "Şifre en az 6 karakter olmalı");
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert("Hata", "Şifreler eşleşmiyor");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: token.trim(), password }),
            });

            if (response.ok) {
                Alert.alert("Başarılı", "Şifreniz güncellendi");
                router.replace("/login");
            } else {
                const data = await response.json();
                Alert.alert("Hata", data.error || "İşlem başarısız");
            }
        } catch (error) {
            Alert.alert("Hata", "Bağlantı hatası");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            <View style={styles.container}>
                <Text style={styles.title}>Yeni Şifre</Text>
                <Text style={styles.subtitle}>
                    E-posta ile gelen kodu girerek şifrenizi yenileyin.
                </Text>

                <TextInput
                    placeholder="Sıfırlama Kodu"
                    placeholderTextColor={colors.textTertiary}
                    value={token}
                    onChangeText={setToken}
                    autoCapitalize="none"
                    style={styles.input}
                />

                <TextInput
                    placeholder="Yeni Şifre"
                    placeholderTextColor={colors.textTertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={styles.input}
                />

                <TextInput
                    placeholder="Yeni Şifre (Tekrar)"
                    placeholderTextColor={colors.textTertiary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    style={styles.input}
                />

                <Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
                    <Text style={styles.buttonText}>
                        {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
                    </Text>
                </Pressable>

                <Pressable style={styles.linkButton} onPress={() => router.replace("/login")}>
                    <Text style={styles.linkText}>Giriş ekranına dön</Text>
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
        fontSize: 24,
        fontWeight: "700",
        textAlign: "center",
        color: colors.text,
    },
    subtitle: {
        fontSize: 14,
        textAlign: "center",
        color: colors.textSecondary,
        marginBottom: 12,
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
    button: {
        backgroundColor: colors.primary,
        padding: 16,
        borderRadius: 12,
        marginTop: 8,
    },
    buttonText: {
        color: "#fff",
        textAlign: "center",
        fontWeight: "bold",
        fontSize: 16,
    },
    linkButton: {
        marginTop: 12,
        padding: 8,
    },
    linkText: {
        color: colors.textSecondary,
        textAlign: "center",
        fontSize: 14,
    },
});
