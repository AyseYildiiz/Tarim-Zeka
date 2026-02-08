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
import { useRouter } from "expo-router";
import { API_URL } from "../config";
import { useTheme } from "../context/ThemeContext";

export default function ForgotPassword() {
    const router = useRouter();
    const { isDark, colors } = useTheme();
    const styles = createStyles(colors);
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);

    const onSubmit = async () => {
        if (!email.trim()) {
            Alert.alert("Hata", "E-posta adresi gerekli");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim() }),
            });

            if (response.ok) {
                Alert.alert(
                    "Başarılı",
                    "Sıfırlama kodu e-posta adresinize gönderildi."
                );
                router.replace("/reset-password");
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
                <Text style={styles.title}>Şifre Sıfırlama</Text>
                <Text style={styles.subtitle}>
                    E-posta adresinizi girin, size bir sıfırlama kodu gönderelim.
                </Text>

                <TextInput
                    placeholder="E-posta"
                    placeholderTextColor={colors.textTertiary}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={styles.input}
                />

                <Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
                    <Text style={styles.buttonText}>
                        {loading ? "Gönderiliyor..." : "Sıfırlama Kodu Gönder"}
                    </Text>
                </Pressable>

                <Pressable
                    style={styles.linkButton}
                    onPress={() => router.push("/reset-password")}
                >
                    <Text style={styles.linkText}>Kodu girmek için devam et</Text>
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
