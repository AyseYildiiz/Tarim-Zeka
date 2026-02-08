import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, SafeAreaView, StatusBar, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function Register() {
    const router = useRouter();
    const { signUp, isLoading } = useAuth();
    const { isDark, colors } = useTheme();
    const styles = createStyles(colors);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [location, setLocation] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);



    const onRegister = async () => {
        if (!name || !email || !password) {
            Alert.alert("Hata", "Ad, e-posta ve şifre zorunludur");
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert("Hata", "Şifreler eşleşmiyor");
            return;
        }

        const result = await signUp(name, email, phone, password, location);
        if (result.success) {
            router.replace("/(tabs)");
        } else {
            Alert.alert("Hata", result.error || "Kayıt başarısız");
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.container}>
                    <Text style={styles.title}>🌾 TarımZeka</Text>
                    <Text style={styles.subtitle}>Üye Ol</Text>

                    <TextInput
                        placeholder="Ad Soyad"
                        placeholderTextColor={colors.textTertiary}
                        value={name}
                        onChangeText={setName}
                        style={styles.input}
                    />

                    <TextInput
                        placeholder="E-posta"
                        placeholderTextColor={colors.textTertiary}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={styles.input}
                    />

                    <TextInput
                        placeholder="Telefon (Opsiyonel)"
                        placeholderTextColor={colors.textTertiary}
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        style={styles.input}
                    />

                    <TextInput
                        placeholder="Şehir (Opsiyonel)"
                        placeholderTextColor={colors.textTertiary}
                        value={location}
                        onChangeText={setLocation}
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

                    <View style={styles.passwordRow}>
                        <TextInput
                            placeholder="Şifre Tekrar"
                            placeholderTextColor={colors.textTertiary}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                            style={styles.passwordInput}
                        />
                        <Pressable
                            style={styles.toggleButton}
                            onPress={() => setShowConfirmPassword((prev) => !prev)}
                        >
                            <Ionicons
                                name={showConfirmPassword ? "eye-off" : "eye"}
                                size={20}
                                color={colors.primary}
                            />
                        </Pressable>
                    </View>

                    <Pressable style={styles.button} onPress={onRegister} disabled={isLoading}>
                        <Text style={styles.buttonText}>
                            {isLoading ? "Bekleyin..." : "Kayıt Ol"}
                        </Text>
                    </Pressable>

                    <Pressable style={styles.linkButton} onPress={() => router.push("/login")}>
                        <Text style={styles.linkText}>
                            Zaten hesabın var mı? <Text style={styles.linkTextBold}>Giriş Yap</Text>
                        </Text>
                    </Pressable>
                </View>
            </ScrollView>
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
    scrollContainer: {
        flexGrow: 1,
        justifyContent: "center",
    },
    container: {
        flex: 1,
        justifyContent: "center",
        padding: 24,
        gap: 12,
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
