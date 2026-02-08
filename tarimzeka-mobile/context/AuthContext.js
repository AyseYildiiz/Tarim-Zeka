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



    }, [token, isLoading, segments]);

    const bootstrapAsync = async () => {
        try {

            const savedToken = await AsyncStorage.getItem("token");
            const savedUser = await AsyncStorage.getItem("user");




            if (savedToken) {
                setToken(savedToken);
                if (savedUser) {
                    setUser(JSON.parse(savedUser));
                }
            }
        } catch (e) {

        } finally {
            setIsLoading(false);

        }
    };

    const authContext = {
        signIn: async (email, password) => {
            try {


                const response = await fetch(`${API_URL}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                });



                const data = await response.json();


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

                return { success: false, error: error.message };
            }
        },

        signUp: async (name, email, phone, password, location) => {
            try {


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

                return { success: false, error: error.message };
            }
        },

        signOut: async () => {
            try {

                await AsyncStorage.removeItem("token");
                await AsyncStorage.removeItem("user");
                setToken(null);
                setUser(null);

            } catch (error) {

            }
        },
    };

    return (
        <AuthContext.Provider value={{ ...authContext, user, token, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}
