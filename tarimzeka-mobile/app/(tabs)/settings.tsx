import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Switch,
    Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { API_URL } from '../../config';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone?: string;
    location?: string;
}

export default function SettingsScreen() {
    const router = useRouter();
    const { isDark, toggleTheme, colors } = useTheme();
    const { signOut } = useAuth();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    // Profil düzenleme states
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [location, setLocation] = useState('');

    // Şifre değiştirme states
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [updatingProfile, setUpdatingProfile] = useState(false);
    const [updatingPassword, setUpdatingPassword] = useState(false);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(`${API_URL}/user/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data);
                setName(data.name);
                setPhone(data.phone || '');
                setLocation(data.location || '');
            }
        } catch (error) {

            Alert.alert('Hata', 'Profil yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const updateProfile = async () => {
        try {
            if (!name.trim()) {
                Alert.alert('Hata', 'Ad soyad boş olamaz');
                return;
            }

            setUpdatingProfile(true);
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(`${API_URL}/user/profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name.trim(),
                    phone: phone.trim() || null,
                    location: location.trim() || null
                })
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data);
                setEditing(false);
                Alert.alert('Başarılı', 'Profil güncellendi');
            } else {
                Alert.alert('Hata', 'Profil güncellenemedi');
            }
        } catch (error) {

            Alert.alert('Hata', 'Bağlantı hatası');
        } finally {
            setUpdatingProfile(false);
        }
    };

    const changePassword = async () => {
        try {
            if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
                Alert.alert('Hata', 'Tüm alanları doldurun');
                return;
            }

            if (newPassword.length < 6) {
                Alert.alert('Hata', 'Yeni şifre en az 6 karakter olmalı');
                return;
            }

            if (newPassword !== confirmPassword) {
                Alert.alert('Hata', 'Yeni şifreler eşleşmiyor');
                return;
            }

            setUpdatingPassword(true);
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(`${API_URL}/user/change-password`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            if (response.ok) {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setChangingPassword(false);
                Alert.alert('Başarılı', 'Şifre değiştirildi');
            } else {
                const error = await response.json();
                Alert.alert('Hata', error.error || 'Şifre değiştirilemedi');
            }
        } catch (error) {

            Alert.alert('Hata', 'Bağlantı hatası');
        } finally {
            setUpdatingPassword(false);
        }
    };

    const logout = async () => {
        Alert.alert('Oturum Kapat', 'Çıkış yapmak istediğinizden emin misiniz?', [
            { text: 'İptal', style: 'cancel' },
            {
                text: 'Çıkış Yap',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await signOut();
                        router.replace('/login' as any);
                    } catch (error) {

                        Alert.alert('Hata', 'Çıkış yapılamadı');
                    }
                }
            }
        ]);
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#16A34A" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>⚙️ Ayarlar</Text>
                </View>

                {/* Profile Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="person-circle" size={24} color={colors.primary} />
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Profil Bilgileri</Text>
                    </View>

                    {!editing ? (
                        <>
                            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                                    <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Ad Soyad</Text>
                                    <Text style={[styles.infoValue, { color: colors.text }]}>{user?.name}</Text>
                                </View>
                                <View style={[styles.infoRow, styles.borderTop, { borderTopColor: colors.border }]}>
                                    <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>E-mail</Text>
                                    <Text style={[styles.infoValue, { color: colors.text }]}>{user?.email}</Text>
                                </View>
                                {user?.phone && (
                                    <View style={[styles.infoRow, styles.borderTop, { borderTopColor: colors.border }]}>
                                        <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Telefon</Text>
                                        <Text style={[styles.infoValue, { color: colors.text }]}>{user.phone}</Text>
                                    </View>
                                )}
                                {user?.location && (
                                    <View style={[styles.infoRow, styles.borderTop, { borderTopColor: colors.border }]}>
                                        <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Konum</Text>
                                        <Text style={[styles.infoValue, { color: colors.text }]}>{user.location}</Text>
                                    </View>
                                )}
                            </View>

                            <TouchableOpacity
                                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                                onPress={() => setEditing(true)}
                            >
                                <Ionicons name="pencil" size={18} color="#fff" />
                                <Text style={styles.primaryButtonText}>Düzenle</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Ad Soyad</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ad soyad"
                                    value={name}
                                    onChangeText={setName}
                                    editable={!updatingProfile}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Telefon</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Telefon numarası"
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                    editable={!updatingProfile}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Konum</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Şehir, İlçe"
                                    value={location}
                                    onChangeText={setLocation}
                                    editable={!updatingProfile}
                                />
                            </View>

                            <View style={styles.buttonGroup}>
                                <TouchableOpacity
                                    style={[styles.primaryButton, updatingProfile && styles.buttonDisabled]}
                                    onPress={updateProfile}
                                    disabled={updatingProfile}
                                >
                                    {updatingProfile ? (
                                        <ActivityIndicator color="#fff" size={18} />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark" size={18} color="#fff" />
                                            <Text style={styles.primaryButtonText}>Kaydet</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={() => {
                                        setEditing(false);
                                        setName(user?.name || '');
                                        setPhone(user?.phone || '');
                                        setLocation(user?.location || '');
                                    }}
                                    disabled={updatingProfile}
                                >
                                    <Ionicons name="close" size={18} color="#64748B" />
                                    <Text style={styles.secondaryButtonText}>İptal</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>

                {/* Security Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="lock-closed" size={24} color="#16A34A" />
                        <Text style={styles.sectionTitle}>Güvenlik</Text>
                    </View>

                    {!changingPassword ? (
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => setChangingPassword(true)}
                        >
                            <Ionicons name="key" size={18} color="#fff" />
                            <Text style={styles.primaryButtonText}>Şifre Değiştir</Text>
                        </TouchableOpacity>
                    ) : (
                        <>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Mevcut Şifre</Text>
                                <View style={styles.passwordInput}>
                                    <TextInput
                                        style={styles.passwordInputField}
                                        placeholder="Mevcut şifre"
                                        secureTextEntry={!showCurrentPassword}
                                        value={currentPassword}
                                        onChangeText={setCurrentPassword}
                                        editable={!updatingPassword}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                                        disabled={updatingPassword}
                                    >
                                        <Ionicons
                                            name={showCurrentPassword ? 'eye' : 'eye-off'}
                                            size={20}
                                            color="#64748B"
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Yeni Şifre</Text>
                                <View style={styles.passwordInput}>
                                    <TextInput
                                        style={styles.passwordInputField}
                                        placeholder="Yeni şifre (min. 6 karakter)"
                                        secureTextEntry={!showNewPassword}
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                        editable={!updatingPassword}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowNewPassword(!showNewPassword)}
                                        disabled={updatingPassword}
                                    >
                                        <Ionicons
                                            name={showNewPassword ? 'eye' : 'eye-off'}
                                            size={20}
                                            color="#64748B"
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Yeni Şifre (Tekrar)</Text>
                                <View style={styles.passwordInput}>
                                    <TextInput
                                        style={styles.passwordInputField}
                                        placeholder="Yeni şifre tekrar"
                                        secureTextEntry={!showConfirmPassword}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        editable={!updatingPassword}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                        disabled={updatingPassword}
                                    >
                                        <Ionicons
                                            name={showConfirmPassword ? 'eye' : 'eye-off'}
                                            size={20}
                                            color="#64748B"
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.buttonGroup}>
                                <TouchableOpacity
                                    style={[styles.primaryButton, updatingPassword && styles.buttonDisabled]}
                                    onPress={changePassword}
                                    disabled={updatingPassword}
                                >
                                    {updatingPassword ? (
                                        <ActivityIndicator color="#fff" size={18} />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark" size={18} color="#fff" />
                                            <Text style={styles.primaryButtonText}>Değiştir</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={() => {
                                        setChangingPassword(false);
                                        setCurrentPassword('');
                                        setNewPassword('');
                                        setConfirmPassword('');
                                    }}
                                    disabled={updatingPassword}
                                >
                                    <Ionicons name="close" size={18} color="#64748B" />
                                    <Text style={styles.secondaryButtonText}>İptal</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>

                {/* Preferences Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="contrast" size={24} color="#16A34A" />
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Tercihler</Text>
                    </View>

                    <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.settingRow}>
                            <View style={styles.settingLabel}>
                                <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color="#16A34A" />
                                <View style={{ marginLeft: 12, flex: 1 }}>
                                    <Text style={[styles.infoLabel, { color: colors.text }]}>{isDark ? '🌙 Koyu Tema' : '☀️ Açık Tema'}</Text>
                                    <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                                        {isDark ? 'Tema: Koyu' : 'Tema: Açık'}
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={isDark}
                                onValueChange={toggleTheme}
                                trackColor={{ false: colors.borderLight, true: colors.primary }}
                                thumbColor={isDark ? colors.surfaceLight : '#ffffff'}
                            />
                        </View>
                    </View>
                </View>

                {/* About Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="information-circle" size={24} color="#16A34A" />
                        <Text style={styles.sectionTitle}>Hakkında</Text>
                    </View>

                    <View style={styles.infoCard}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Uygulama</Text>
                            <Text style={styles.infoValue}>TarımZeka</Text>
                        </View>
                        <View style={[styles.infoRow, styles.borderTop]}>
                            <Text style={styles.infoLabel}>Versiyon</Text>
                            <Text style={styles.infoValue}>1.0.0</Text>
                        </View>
                        <View style={[styles.infoRow, styles.borderTop]}>
                            <Text style={styles.infoLabel}>Geliştirici</Text>
                            <Text style={styles.infoValue}>TarımZeka Team</Text>
                        </View>
                    </View>
                </View>

                {/* Logout Section */}
                <View style={styles.section}>
                    <TouchableOpacity
                        style={styles.dangerButton}
                        onPress={logout}
                    >
                        <Ionicons name="log-out" size={18} color="#fff" />
                        <Text style={styles.dangerButtonText}>Oturum Kapat</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        padding: 20,
        paddingTop: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0'
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1E293B'
    },
    section: {
        marginHorizontal: 12,
        marginTop: 16,
        marginBottom: 4
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
        marginLeft: 10
    },
    infoCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
        marginBottom: 12
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14
    },
    borderTop: {
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    infoLabel: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '500'
    },
    infoValue: {
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '600'
    },
    formGroup: {
        marginBottom: 16
    },
    label: {
        fontSize: 13,
        color: '#475569',
        fontWeight: '600',
        marginBottom: 8
    },
    input: {
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: '#1E293B'
    },
    passwordInput: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 14,
        paddingVertical: 0
    },
    passwordInputField: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 14,
        color: '#1E293B'
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#16A34A',
        borderRadius: 10,
        paddingVertical: 12,
        marginBottom: 12
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E2E8F0',
        borderRadius: 10,
        paddingVertical: 12
    },
    secondaryButtonText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6
    },
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EF4444',
        borderRadius: 10,
        paddingVertical: 12,
        marginBottom: 12
    },
    dangerButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6
    },
    buttonGroup: {
        marginBottom: 12
    },
    buttonDisabled: {
        opacity: 0.6
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14
    },
    settingLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    settingDescription: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 2
    }
});
