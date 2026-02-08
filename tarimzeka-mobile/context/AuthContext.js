import React, { createContext, useState, useEffect, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useSegments } from "expo-router";
import { API_URL } from "../config";

export const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const segments = useSegments();

    // Bootstrap - token'ı kontrol et
    useEffect(() => {
        bootstrapAsync();
    }, []);

    // Token değişirse navigate et
    useEffect(() => {
        if (isLoading) return;

        console.log("🔍 Auth state:", { token: token ? "exists" : "missing", isLoading });

    }, [token, isLoading, segments]);

    const bootstrapAsync = async () => {
        try {
            console.log("⏳ Bootstrap başladı");
            const savedToken = await AsyncStorage.getItem("token");
            const savedUser = await AsyncStorage.getItem("user");

            console.log("📦 Saved token:", savedToken ? "exists" : "missing");
            console.log("👤 Saved user:", savedUser ? "exists" : "missing");

            if (savedToken) {
                setToken(savedToken);
                if (savedUser) {
                    setUser(JSON.parse(savedUser));
                }
            }
        } catch (e) {
            console.error("❌ Bootstrap error:", e);
        } finally {
            setIsLoading(false);
            console.log("✅ Bootstrap bitti");
        }
    };

    const authContext = {
        signIn: async (email, password) => {
            try {
                console.log("🔐 SignIn başladı:", email);

                const response = await fetch(`${API_URL}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                });

                console.log("📊 Response status:", response.status);

                const data = await response.json();
                console.log("📦 Response:", data);

                if (response.ok && data.token) {
                    console.log("✅ Token alındı");

                    await AsyncStorage.setItem("token", data.token);
                    await AsyncStorage.setItem("user", JSON.stringify(data.user));

                    setToken(data.token);
                    setUser(data.user);

                    console.log("🎉 Login başarılı");
                    return { success: true };
                } else {
                    console.log("❌ Login hatası:", data.error);
                    return { success: false, error: data.error };
                }
            } catch (error) {
                console.error("🚨 SignIn error:", error);
                return { success: false, error: error.message };
            }
        },

        signUp: async (name, email, phone, password, location) => {
            try {
                console.log("📝 SignUp başladı:", email);

                const response = await fetch(`${API_URL}/auth/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name,
                        email,
                        phone,
                        password,
                        location,
                    }),
                });

                const data = await response.json();
                console.log("📦 Register response:", data);

                if (response.ok && data.token) {
                    await AsyncStorage.setItem("token", data.token);
                    await AsyncStorage.setItem("user", JSON.stringify(data.user));
                    setToken(data.token);
                    setUser(data.user);
                    return { success: true };
                } else {
                    return { success: false, error: data.error };
                }
            } catch (error) {
                console.error("🚨 SignUp error:", error);
                return { success: false, error: error.message };
            }
        },

        signOut: async () => {
            try {
                console.log("🚪 SignOut başladı");
                await AsyncStorage.removeItem("token");
                await AsyncStorage.removeItem("user");
                setToken(null);
                setUser(null);
                console.log("✅ SignOut başarılı");
            } catch (error) {
                console.error("❌ SignOut error:", error);
            }
        },
    };

    return (
        <AuthContext.Provider value={{ ...authContext, user, token, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}