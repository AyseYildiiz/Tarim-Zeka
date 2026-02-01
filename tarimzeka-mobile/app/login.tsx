import { useState } from "react";
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
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";

export default function Login() {
    const router = useRouter();
    const { signIn, isLoading } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    console.log("🔓 Login sayfası render edildi");

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
            <StatusBar barStyle="light-content" />
            <View style={styles.container}>
                <Text style={styles.title}>🌾 TarımZeka</Text>
                <Text style={styles.subtitle}>Giriş Yap</Text>

                <TextInput
                    placeholder="E-posta"
                    placeholderTextColor="#888"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={styles.input}
                />
                <TextInput
                    placeholder="Şifre"
                    placeholderTextColor="#888"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={styles.input}
                />

                <Pressable style={styles.button} onPress={onLogin} disabled={isLoading}>
                    <Text style={styles.buttonText}>
                        {isLoading ? "Bekleyin..." : "Giriş Yap"}
                    </Text>
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

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#0f172a",
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
        color: "#16A34A",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 20,
        textAlign: "center",
        color: "#fff",
        marginBottom: 24,
    },
    input: {
        borderWidth: 1,
        borderColor: "#334155",
        borderRadius: 12,
        padding: 16,
        backgroundColor: "#1e293b",
        color: "#fff",
        fontSize: 16,
    },
    button: {
        backgroundColor: "#16A34A",
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
        color: "#94a3b8",
        textAlign: "center",
        fontSize: 14,
    },
    linkTextBold: {
        color: "#16A34A",
        fontWeight: "bold",
    },
});