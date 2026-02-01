import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, SafeAreaView, StatusBar, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";

export default function Register() {
    const router = useRouter();
    const { signUp, isLoading } = useAuth();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [location, setLocation] = useState("");

    console.log("📝 Register sayfası render edildi");

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
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.container}>
                    <Text style={styles.title}>🌾 TarımZeka</Text>
                    <Text style={styles.subtitle}>Üye Ol</Text>

                    <TextInput
                        placeholder="Ad Soyad"
                        placeholderTextColor="#888"
                        value={name}
                        onChangeText={setName}
                        style={styles.input}
                    />

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
                        placeholder="Telefon (Opsiyonel)"
                        placeholderTextColor="#888"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        style={styles.input}
                    />

                    <TextInput
                        placeholder="Konum (Opsiyonel)"
                        placeholderTextColor="#888"
                        value={location}
                        onChangeText={setLocation}
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

                    <TextInput
                        placeholder="Şifre Tekrar"
                        placeholderTextColor="#888"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        style={styles.input}
                    />

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

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#0f172a",
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