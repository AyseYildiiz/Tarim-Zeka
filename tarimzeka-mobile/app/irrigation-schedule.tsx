import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { API_URL } from '../config';
import { useTheme } from '../context/ThemeContext';

interface ScheduleItem {
    id: string;
    date: string;
    recommendedTime: string;
    waterAmount: number;
    weatherTemp: number;
    weatherHumidity: number;
    weatherCondition: string;
    status: string;
    note?: string;
}

interface Field {
    id: string;
    name: string;
    cropType: string;
    soilType: string;
    area?: number;
}

export default function IrrigationScheduleScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const fieldId = params.fieldId as string;
    const { colors, isDark } = useTheme();
    const styles = createStyles(colors, isDark);

    const [field, setField] = useState<Field | null>(null);
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [calculating, setCalculating] = useState(false);

    useEffect(() => {
        loadData();
    }, [fieldId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('token');

            // Load field data
            const fieldRes = await fetch(`${API_URL}/fields/${fieldId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (fieldRes.ok) {
                const fieldData = await fieldRes.json();
                setField(fieldData);

                // Schedules included in field data - convert waterAmount to total liters
                const areaM2 = (fieldData.area ?? 1) * 1000;
                const schedules = (fieldData.schedules || []).map((schedule: ScheduleItem) => ({
                    ...schedule,
                    waterAmount: Math.round((schedule.waterAmount || 0) * areaM2)
                }));
                setSchedules(schedules);
            }
        } catch (error) {

            Alert.alert('Hata', 'Veriler yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const calculateNewSchedule = async () => {
        try {
            setCalculating(true);
            const token = await AsyncStorage.getItem('token');

            const response = await fetch(
                `${API_URL}/fields/${fieldId}/calculate-irrigation-schedule`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                setSchedules(data.schedule || []);
                Alert.alert('Başarılı', 'Sulama takvimi güncellendi');
            } else {
                Alert.alert('Hata', 'Takvim güncellenemedi');
            }
        } catch (error) {

            Alert.alert('Hata', 'Bağlantı hatası');
        } finally {
            setCalculating(false);
        }
    };

    const completeSchedule = async (scheduleId: string) => {
        try {
            const token = await AsyncStorage.getItem('token');
            const waterAmount = schedules.find(s => s.id === scheduleId)?.waterAmount || 0;

            const response = await fetch(
                `${API_URL}/irrigation/schedules/${scheduleId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: 'completed',
                        actualWaterUsed: waterAmount
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json();

                Alert.alert('Hata', `Sulama tamamlanamadı: ${errorData.error || 'Bilinmeyen hata'}`);
                return;
            }

            const data = await response.json();


            // Immediately refresh data from server to ensure consistency
            await loadData();
            Alert.alert('Başarılı', 'Sulama tamamlandı');
        } catch (error) {

            Alert.alert('Hata', 'Bağlantı hatası: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('tr-TR', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    const getWeatherIcon = (condition: string) => {
        const lower = condition.toLowerCase();
        if (lower.includes('yağmur') || lower.includes('rain')) return '🌧️';
        if (lower.includes('güneşli') || lower.includes('sunny') || lower.includes('clear')) return '☀️';
        if (lower.includes('bulut') || lower.includes('cloud')) return '⛅';
        if (lower.includes('kar') || lower.includes('snow')) return '❄️';
        return '🌤️';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return '#22C55E';
            case 'skipped': return '#EF4444';
            default: return '#F59E0B';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completed': return 'Tamamlandı';
            case 'skipped': return 'Atlandı';
            default: return 'Beklemede';
        }
    };

    const getWaterLevelLabel = (perM2: number) => {
        if (perM2 <= 2) return 'Çok Az';
        if (perM2 <= 4) return 'Az';
        if (perM2 <= 6) return 'Orta';
        if (perM2 <= 8) return 'Yüksek';
        return 'Çok Yüksek';
    };

    const getPerM2Amount = (totalLiters: number) => {
        const areaM2 = (field?.area ?? 1) * 1000;
        return areaM2 > 0 ? totalLiters / areaM2 : totalLiters;
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    const upcomingSchedules = schedules.filter(s => s.status === 'pending');
    const completedSchedules = schedules.filter(s => s.status === 'completed');

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={colors.primary} />
                    </TouchableOpacity>
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle}>💧 Sulama Takvimi</Text>
                        <Text style={styles.headerSubtitle}>{field?.name}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.refreshButton}
                        onPress={calculateNewSchedule}
                        disabled={calculating}
                    >
                        {calculating ? (
                            <ActivityIndicator color={colors.primary} size={24} />
                        ) : (
                            <Ionicons name="refresh" size={24} color={colors.primary} />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Field Info Card */}
                <View style={styles.fieldCard}>
                    <View style={styles.fieldCardRow}>
                        <View style={styles.fieldCardItem}>
                            <Text style={styles.fieldCardLabel}>Ürün</Text>
                            <Text style={styles.fieldCardValue}>{field?.cropType}</Text>
                        </View>
                        <View style={styles.fieldCardItem}>
                            <Text style={styles.fieldCardLabel}>Toprak</Text>
                            <Text style={styles.fieldCardValue}>{field?.soilType}</Text>
                        </View>
                    </View>
                </View>

                {/* Upcoming Schedule */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📅 Yaklaşan Sulamalar ({upcomingSchedules.length})</Text>

                    {upcomingSchedules.length > 0 ? (
                        upcomingSchedules.map((schedule) => (
                            <TouchableOpacity
                                key={schedule.id}
                                style={styles.scheduleCard}
                                onPress={() => completeSchedule(schedule.id)}
                            >
                                <View style={styles.scheduleHeader}>
                                    <View style={styles.scheduleDate}>
                                        <Text style={styles.scheduleDateText}>
                                            {formatDate(schedule.date)}
                                        </Text>
                                        <Text style={styles.scheduleTime}>
                                            {schedule.recommendedTime}
                                        </Text>
                                    </View>
                                    <View style={styles.scheduleWeather}>
                                        <Text style={styles.weatherIcon}>
                                            {getWeatherIcon(schedule.weatherCondition)}
                                        </Text>
                                        <Text style={styles.weatherTemp}>
                                            {schedule.weatherTemp}°C
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.scheduleDetails}>
                                    <View style={styles.detailItem}>
                                        <Ionicons name="water" size={16} color="#3B82F6" />
                                        <Text style={styles.detailText}>
                                            {getWaterLevelLabel(getPerM2Amount(schedule.waterAmount))} • {schedule.waterAmount} L ({getPerM2Amount(schedule.waterAmount).toFixed(1)} L/m²)
                                        </Text>
                                    </View>
                                    <View style={styles.detailItem}>
                                        <Ionicons name="water-outline" size={16} color="#60A5FA" />
                                        <Text style={styles.detailText}>
                                            {schedule.weatherHumidity}% nem
                                        </Text>
                                    </View>
                                </View>

                                {schedule.note && (
                                    <View style={styles.noteContainer}>
                                        <Ionicons name="information-circle" size={14} color="#FCD34D" />
                                        <Text style={styles.noteText}>{schedule.note}</Text>
                                    </View>
                                )}

                                <View style={styles.scheduleFooter}>
                                    <Text style={styles.weatherCondition}>
                                        {schedule.weatherCondition}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.completeButton}
                                        onPress={() => completeSchedule(schedule.id)}
                                    >
                                        <Ionicons name="checkmark" size={16} color="#fff" />
                                        <Text style={styles.completeButtonText}>Tamamla</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                ✨ Henüz sulama takvimi yok
                            </Text>
                            <Text style={styles.emptySubtext}>
                                Yeni takvim oluşturmak için yukarıdaki yenile butonuna tıklayın
                            </Text>
                        </View>
                    )}
                </View>

                {/* Completed Schedule */}
                {completedSchedules.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>✅ Tamamlanan ({completedSchedules.length})</Text>
                        {completedSchedules.slice(0, 3).map((schedule) => (
                            <View key={schedule.id} style={styles.completedCard}>
                                <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                                <View style={styles.completedInfo}>
                                    <Text style={styles.completedDate}>
                                        {formatDate(schedule.date)}
                                    </Text>
                                    <Text style={styles.completedAmount}>
                                        {getWaterLevelLabel(getPerM2Amount(schedule.waterAmount))} • {schedule.waterAmount} L ({getPerM2Amount(schedule.waterAmount).toFixed(1)} L/m²)
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Info Section */}
                <View style={styles.infoSection}>
                    <View style={styles.infoBox}>
                        <Ionicons name="bulb" size={20} color="#F59E0B" />
                        <Text style={styles.infoText}>
                            ✨ Sulama takvimi hava durumu, toprak türü ve ekin değerine göre yapay zeka tarafından
                            otomatik olarak hesaplanmaktadır. En verimli sulama için önerileri izleyin.
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: {
    background: string;
    surface: string;
    surfaceLight: string;
    text: string;
    textSecondary: string;
    primary: string;
    border: string;
    borderLight: string;
    warning: string;
}, isDark: boolean) => {
    const noteBackground = isDark ? '#422006' : '#FEF3C7';
    const noteText = isDark ? '#FCD34D' : '#92400E';
    const infoBackground = isDark ? '#422006' : '#FFFBEB';
    const infoBorder = isDark ? '#7C2D12' : '#FED7AA';
    const completedBackground = isDark ? '#064E3B' : '#ECFDF5';
    const completedBorder = isDark ? '#065F46' : '#DCFCE7';

    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.background
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border
        },
        headerInfo: {
            flex: 1,
            marginLeft: 12
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text
        },
        headerSubtitle: {
            fontSize: 13,
            color: colors.textSecondary,
            marginTop: 2
        },
        refreshButton: {
            padding: 8
        },
        fieldCard: {
            marginHorizontal: 12,
            marginTop: 12,
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border
        },
        fieldCardRow: {
            flexDirection: 'row',
            justifyContent: 'space-around'
        },
        fieldCardItem: {
            alignItems: 'center',
            flex: 1
        },
        fieldCardLabel: {
            fontSize: 12,
            color: colors.textSecondary,
            marginBottom: 4
        },
        fieldCardValue: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text
        },
        section: {
            marginTop: 20,
            paddingHorizontal: 12
        },
        sectionTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 12
        },
        scheduleCard: {
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 12,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: colors.border,
            borderLeftWidth: 4,
            borderLeftColor: colors.warning
        },
        scheduleHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10
        },
        scheduleDate: {
            flex: 1
        },
        scheduleDateText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text
        },
        scheduleTime: {
            fontSize: 12,
            color: colors.textSecondary,
            marginTop: 2
        },
        scheduleWeather: {
            alignItems: 'center'
        },
        weatherIcon: {
            fontSize: 28
        },
        weatherTemp: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.text,
            marginTop: 2
        },
        scheduleDetails: {
            flexDirection: 'row',
            marginBottom: 8,
            paddingBottom: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderLight
        },
        detailItem: {
            flexDirection: 'row',
            alignItems: 'center',
            marginRight: 16
        },
        detailText: {
            fontSize: 12,
            color: colors.textSecondary,
            marginLeft: 4
        },
        noteContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: noteBackground,
            borderRadius: 6,
            padding: 8,
            marginBottom: 8
        },
        noteText: {
            fontSize: 12,
            color: noteText,
            marginLeft: 6,
            flex: 1
        },
        scheduleFooter: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center'
        },
        weatherCondition: {
            fontSize: 12,
            color: colors.textSecondary,
            flex: 1
        },
        completeButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.primary,
            borderRadius: 6,
            paddingHorizontal: 10,
            paddingVertical: 6
        },
        completeButtonText: {
            fontSize: 12,
            color: '#fff',
            fontWeight: '600',
            marginLeft: 4
        },
        completedCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: completedBackground,
            borderRadius: 10,
            padding: 12,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: completedBorder
        },
        completedInfo: {
            marginLeft: 12,
            flex: 1
        },
        completedDate: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text
        },
        completedAmount: {
            fontSize: 11,
            color: colors.textSecondary,
            marginTop: 2
        },
        emptyContainer: {
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 24,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            borderStyle: 'dashed'
        },
        emptyText: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 4
        },
        emptySubtext: {
            fontSize: 12,
            color: colors.textSecondary,
            textAlign: 'center'
        },
        infoSection: {
            padding: 12,
            marginTop: 20
        },
        infoBox: {
            backgroundColor: infoBackground,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: infoBorder,
            flexDirection: 'row',
            alignItems: 'flex-start'
        },
        infoText: {
            fontSize: 12,
            color: noteText,
            marginLeft: 10,
            flex: 1,
            lineHeight: 18
        }
    });
};
