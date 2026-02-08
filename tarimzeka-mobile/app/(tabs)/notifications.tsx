import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../config';
import { useTheme } from '../../context/ThemeContext';

interface Notification {
    id: string;
    type: 'rain' | 'irrigation' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
    time: string;
    read: boolean;
    fieldName?: string;
}

export default function NotificationsScreen() {
    const { colors } = useTheme();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadNotifications();
    }, []);

    const loadNotifications = async () => {
        try {
            const token = await AsyncStorage.getItem('token');

            if (!token) {
                setNotifications([]);
                setLoading(false);
                return;
            }

            // Backend'den bildirimleri çek
            const response = await fetch(`${API_URL}/notifications`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Backend verilerini UI formatına çevir
            const formattedNotifications: Notification[] = data.map((notif: any) => {
                // Bildirim türünü belirle
                let type: Notification['type'] = 'info';
                if (notif.type === 'irrigation') {
                    type = 'irrigation';
                } else if (notif.type === 'weather_warning' || notif.type === 'rain') {
                    type = 'rain';
                } else if (notif.type === 'warning') {
                    type = 'warning';
                } else if (notif.type === 'success') {
                    type = 'success';
                }

                // Tarihi formatla
                const date = new Date(notif.createdAt);
                const now = new Date();
                const diffMs = now.getTime() - date.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays = Math.floor(diffMs / 86400000);

                let timeText = 'az önce';
                if (diffMins < 60) {
                    timeText = `${diffMins} dakika önce`;
                } else if (diffHours < 24) {
                    timeText = `${diffHours} saat önce`;
                } else if (diffDays < 7) {
                    timeText = `${diffDays} gün önce`;
                } else {
                    timeText = date.toLocaleDateString('tr-TR');
                }

                return {
                    id: notif.id,
                    type,
                    title: notif.title,
                    message: notif.message,
                    time: timeText,
                    read: notif.isRead,
                    fieldName: notif.fieldName
                };
            });

            setNotifications(formattedNotifications);
        } catch (error) {

            // Hata durumunda boş liste göster
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadNotifications();
        setRefreshing(false);
    };

    const markAsRead = async (id: string) => {
        try {
            const token = await AsyncStorage.getItem('token');

            await fetch(`${API_URL}/notifications/${id}/read`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, read: true } : n)
            );
        } catch (error) {

        }
    };

    const markAllAsRead = async () => {
        try {
            const token = await AsyncStorage.getItem('token');

            await fetch(`${API_URL}/notifications/mark-all/read`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (error) {

        }
    };

    const deleteNotification = async (id: string) => {
        try {
            const token = await AsyncStorage.getItem('token');

            await fetch(`${API_URL}/notifications/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {

        }
    };

    const getIconConfig = (type: Notification['type']) => {
        switch (type) {
            case 'rain':
                return { name: 'rainy', color: '#3B82F6', bg: '#1e3a5f' };
            case 'irrigation':
                return { name: 'water', color: '#06B6D4', bg: '#164e63' };
            case 'warning':
                return { name: 'warning', color: '#F59E0B', bg: '#422006' };
            case 'success':
                return { name: 'checkmark-circle', color: '#16A34A', bg: '#064e3b' };
            case 'info':
            default:
                return { name: 'information-circle', color: '#94a3b8', bg: '#1e293b' };
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color="#16A34A" />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>🔔 Bildirimler</Text>
                    {unreadCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unreadCount}</Text>
                        </View>
                    )}
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {unreadCount > 0 && (
                        <TouchableOpacity onPress={markAllAsRead}>
                            <Text style={[styles.markAllText, { color: colors.primary }]}>Tümünü Okundu</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {notifications.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="notifications-off-outline" size={64} color={colors.textTertiary} />
                        <Text style={[styles.emptyStateTitle, { color: colors.textSecondary }]}>Bildirim Yok</Text>
                        <Text style={[styles.emptyStateText, { color: colors.textTertiary }]}>
                            Yeni bildirimler burada görünecek
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Unread Notifications */}
                        {notifications.filter(n => !n.read).length > 0 && (
                            <View style={styles.section}>
                                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Yeni</Text>
                                {notifications.filter(n => !n.read).map((notification) => {
                                    const iconConfig = getIconConfig(notification.type);
                                    return (
                                        <TouchableOpacity
                                            key={notification.id}
                                            style={[
                                                styles.notificationCard,
                                                styles.unreadCard,
                                                { backgroundColor: colors.surface, borderLeftColor: colors.primary }
                                            ]}
                                            onPress={() => markAsRead(notification.id)}
                                        >
                                            <View style={[styles.iconContainer, { backgroundColor: iconConfig.bg }]}>
                                                <Ionicons
                                                    name={iconConfig.name as any}
                                                    size={24}
                                                    color={iconConfig.color}
                                                />
                                            </View>
                                            <View style={styles.notificationContent}>
                                                <Text style={[styles.notificationTitle, { color: colors.text }]}>{notification.title}</Text>
                                                <Text style={[styles.notificationMessage, { color: colors.textSecondary }]}>{notification.message}</Text>
                                                <View style={styles.notificationFooter}>
                                                    <Text style={[styles.notificationTime, { color: colors.textTertiary }]}>{notification.time}</Text>
                                                    {notification.fieldName && (
                                                        <View style={[styles.fieldTag, { backgroundColor: colors.primaryDark }]}>
                                                            <Ionicons name="leaf" size={12} color={colors.primary} />
                                                            <Text style={[styles.fieldTagText, { color: colors.primary }]}>{notification.fieldName}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                            <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {/* Read Notifications */}
                        {notifications.filter(n => n.read).length > 0 && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Önceki</Text>
                                    <TouchableOpacity
                                        onPress={() => {
                                            notifications.filter(n => n.read).forEach(n => deleteNotification(n.id));
                                        }}
                                    >
                                        <Text style={[styles.clearText, { color: colors.textSecondary }]}>Temizle</Text>
                                    </TouchableOpacity>
                                </View>
                                {notifications.filter(n => n.read).map((notification) => {
                                    const iconConfig = getIconConfig(notification.type);
                                    return (
                                        <View key={notification.id} style={[styles.notificationCard, { backgroundColor: colors.surface }]}>
                                            <View style={[styles.iconContainer, { backgroundColor: iconConfig.bg }]}>
                                                <Ionicons
                                                    name={iconConfig.name as any}
                                                    size={24}
                                                    color={iconConfig.color}
                                                />
                                            </View>
                                            <View style={styles.notificationContent}>
                                                <Text style={[styles.notificationTitle, styles.readTitle, { color: colors.textSecondary }]}>
                                                    {notification.title}
                                                </Text>
                                                <Text style={[styles.notificationMessage, styles.readMessage, { color: colors.textTertiary }]}>
                                                    {notification.message}
                                                </Text>
                                                <View style={styles.notificationFooter}>
                                                    <Text style={[styles.notificationTime, { color: colors.textTertiary }]}>{notification.time}</Text>
                                                    {notification.fieldName && (
                                                        <View style={[styles.fieldTag, { backgroundColor: colors.primaryDark }]}>
                                                            <Ionicons name="leaf" size={12} color={colors.primary} />
                                                            <Text style={[styles.fieldTagText, { color: colors.primary }]}>{notification.fieldName}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => deleteNotification(notification.id)}
                                                style={styles.deleteButton}
                                            >
                                                <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    badge: {
        backgroundColor: '#EF4444',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    badgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    markAllText: {
        color: '#16A34A',
        fontSize: 14,
    },
    scrollView: {
        flex: 1,
    },
    section: {
        padding: 20,
        paddingTop: 0,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    clearText: {
        fontSize: 12,
        color: '#94a3b8',
        textDecorationLine: 'underline',
    },
    notificationCard: {
        flexDirection: 'row',
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    unreadCard: {
        borderLeftWidth: 3,
        borderLeftColor: '#16A34A',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    notificationContent: {
        flex: 1,
    },
    notificationTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    readTitle: {
        color: '#94a3b8',
    },
    notificationMessage: {
        fontSize: 14,
        color: '#94a3b8',
        lineHeight: 20,
        marginBottom: 8,
    },
    readMessage: {
        color: '#64748b',
    },
    notificationFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    notificationTime: {
        fontSize: 12,
        color: '#64748b',
    },
    fieldTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#064e3b',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    fieldTagText: {
        fontSize: 11,
        color: '#16A34A',
    },
    deleteButton: {
        padding: 8,
        marginLeft: 12,
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#16A34A',
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    emptyState: {
        alignItems: 'center',
        padding: 60,
    },
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#94a3b8',
        marginTop: 16,
    },
    emptyStateText: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 8,
        textAlign: 'center',
    },
    recommendationValue: {
        fontSize: 14,
        color: '#16A34A',
        fontWeight: 'bold',
    },
});
