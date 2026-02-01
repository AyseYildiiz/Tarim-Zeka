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
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadNotifications();
    }, []);

    const loadNotifications = async () => {
        try {
            const token = await AsyncStorage.getItem('token');

            // API'den bildirimleri çek (şimdilik mock data)
            // const response = await fetch(`${API_URL}/notifications`, {...});

            // Mock data
            const mockNotifications: Notification[] = [
                {
                    id: '1',
                    type: 'rain',
                    title: '🌧️ Yağış Uyarısı',
                    message: 'Yarın öğleden sonra yağış bekleniyor. Sulama planınızı gözden geçirin.',
                    time: '2 saat önce',
                    read: false,
                },
                {
                    id: '2',
                    type: 'irrigation',
                    title: '💧 Sulama Zamanı',
                    message: 'Kuzey Tarla için sulama saati yaklaşıyor.',
                    time: '3 saat önce',
                    read: false,
                    fieldName: 'Kuzey Tarla'
                },
                {
                    id: '3',
                    type: 'success',
                    title: '✅ Sulama Tamamlandı',
                    message: 'Güney Bahçe sulaması başarıyla tamamlandı.',
                    time: '5 saat önce',
                    read: true,
                    fieldName: 'Güney Bahçe'
                },
                {
                    id: '4',
                    type: 'warning',
                    title: '⚠️ Düşük Nem Uyarısı',
                    message: 'Batı Tarla toprak nemi kritik seviyenin altına düştü.',
                    time: '1 gün önce',
                    read: true,
                    fieldName: 'Batı Tarla'
                },
                {
                    id: '5',
                    type: 'info',
                    title: 'ℹ️ Hava Durumu Güncellemesi',
                    message: 'Önümüzdeki hafta sıcaklıklar mevsim normallerinin üzerinde olacak.',
                    time: '1 gün önce',
                    read: true,
                },
                {
                    id: '6',
                    type: 'irrigation',
                    title: '💧 Sulama Hatırlatması',
                    message: 'Yarın sabah 06:00\'da Kuzey Tarla için sulama planlandı.',
                    time: '2 gün önce',
                    read: true,
                    fieldName: 'Kuzey Tarla'
                },
            ];

            setNotifications(mockNotifications);
        } catch (error) {
            console.error('Load notifications error:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadNotifications();
        setRefreshing(false);
    };

    const markAsRead = (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
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
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#16A34A" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>🔔 Bildirimler</Text>
                    {unreadCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unreadCount}</Text>
                        </View>
                    )}
                </View>
                {unreadCount > 0 && (
                    <TouchableOpacity onPress={markAllAsRead}>
                        <Text style={styles.markAllText}>Tümünü Okundu İşaretle</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                style={styles.scrollView}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {notifications.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="notifications-off-outline" size={64} color="#64748b" />
                        <Text style={styles.emptyStateTitle}>Bildirim Yok</Text>
                        <Text style={styles.emptyStateText}>
                            Yeni bildirimler burada görünecek
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Unread Notifications */}
                        {notifications.filter(n => !n.read).length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Yeni</Text>
                                {notifications.filter(n => !n.read).map((notification) => {
                                    const iconConfig = getIconConfig(notification.type);
                                    return (
                                        <TouchableOpacity
                                            key={notification.id}
                                            style={[styles.notificationCard, styles.unreadCard]}
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
                                                <Text style={styles.notificationTitle}>{notification.title}</Text>
                                                <Text style={styles.notificationMessage}>{notification.message}</Text>
                                                <View style={styles.notificationFooter}>
                                                    <Text style={styles.notificationTime}>{notification.time}</Text>
                                                    {notification.fieldName && (
                                                        <View style={styles.fieldTag}>
                                                            <Ionicons name="leaf" size={12} color="#16A34A" />
                                                            <Text style={styles.fieldTagText}>{notification.fieldName}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                            <View style={styles.unreadDot} />
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {/* Read Notifications */}
                        {notifications.filter(n => n.read).length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Önceki</Text>
                                {notifications.filter(n => n.read).map((notification) => {
                                    const iconConfig = getIconConfig(notification.type);
                                    return (
                                        <View key={notification.id} style={styles.notificationCard}>
                                            <View style={[styles.iconContainer, { backgroundColor: iconConfig.bg }]}>
                                                <Ionicons
                                                    name={iconConfig.name as any}
                                                    size={24}
                                                    color={iconConfig.color}
                                                />
                                            </View>
                                            <View style={styles.notificationContent}>
                                                <Text style={[styles.notificationTitle, styles.readTitle]}>
                                                    {notification.title}
                                                </Text>
                                                <Text style={[styles.notificationMessage, styles.readMessage]}>
                                                    {notification.message}
                                                </Text>
                                                <View style={styles.notificationFooter}>
                                                    <Text style={styles.notificationTime}>{notification.time}</Text>
                                                    {notification.fieldName && (
                                                        <View style={styles.fieldTag}>
                                                            <Ionicons name="leaf" size={12} color="#16A34A" />
                                                            <Text style={styles.fieldTagText}>{notification.fieldName}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
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
    sectionTitle: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
        marginBottom: 12,
        textTransform: 'uppercase',
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
});